import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { runEnrichmentPass } from "@/lib/enrichment";
import { loadActiveKeepers, isDuplicate } from "@/lib/dedupe";
import { recordSyncLog, type TrackedChange } from "@/lib/syncLog";

interface IncomingFolder {
  chromeFolderId: string;
  parentChromeFolderId: string | null;
  name: string;
  path: string;
  index: number;
}

interface IncomingBookmark {
  chromeBookmarkId: string;
  title: string;
  url: string;
  parentChromeFolderId: string | null;
  path: string;
  index: number;
  dateAdded: number;
}

// POST /api/bookmarks/batch
// Initial (or full re-) import of a Chrome profile's bookmark tree.
// PRD §11, §64: folders must be sent parent-before-child so this handler
// can resolve parentFolderId as it walks the array in order.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const profileId = body?.profileId as string | undefined;
  const folders = (body?.folders ?? []) as IncomingFolder[];
  const bookmarks = (body?.bookmarks ?? []) as IncomingBookmark[];

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const profile = await prisma.chromeProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    return NextResponse.json({ error: "Unknown profileId" }, { status: 404 });
  }

  await prisma.chromeProfile.update({
    where: { id: profileId },
    data: { connectionStatus: "syncing" },
  });

  const chromeFolderIdToDbId = new Map<string, string>();
  // Structural depth (via the parent chain), not the display path string —
  // a folder name that happens to contain " / " would otherwise throw off
  // a naive path.split(" / ").length count.
  const chromeFolderDepth = new Map<string, number>();

  for (const folder of folders) {
    const parentFolderId = folder.parentChromeFolderId
      ? chromeFolderIdToDbId.get(folder.parentChromeFolderId) ?? null
      : null;
    const parentDepth = folder.parentChromeFolderId
      ? chromeFolderDepth.get(folder.parentChromeFolderId) ?? 0
      : 0;
    chromeFolderDepth.set(folder.chromeFolderId, parentDepth + 1);

    const saved = await prisma.bookmarkFolder.upsert({
      where: {
        chromeProfileId_chromeFolderId: {
          chromeProfileId: profileId,
          chromeFolderId: folder.chromeFolderId,
        },
      },
      create: {
        chromeProfileId: profileId,
        chromeFolderId: folder.chromeFolderId,
        parentFolderId,
        name: folder.name,
        path: folder.path,
        position: folder.index,
      },
      update: {
        parentFolderId,
        name: folder.name,
        path: folder.path,
        position: folder.index,
      },
    });
    chromeFolderIdToDbId.set(folder.chromeFolderId, saved.id);
  }

  // Exact-URL duplicates must never resurrect on a re-sync, and any brand
  // new duplicate should be suppressed immediately instead of showing up
  // in the library. Deepest-folder-first processing order means that when
  // two incoming bookmarks share a URL, whichever is filed more specifically
  // becomes the keeper — same tie-break rule used for the one-off cleanup.
  const keepers = await loadActiveKeepers(profileId);
  const depthOf = (bm: IncomingBookmark) =>
    bm.parentChromeFolderId ? chromeFolderDepth.get(bm.parentChromeFolderId) ?? 0 : 0;
  const orderedBookmarks = [...bookmarks].sort((a, b) => depthOf(b) - depthOf(a));

  // Existing state, loaded once, so each bookmark's transition (and whether
  // it's actually worth logging) can be computed without a query per row.
  const existingBookmarks = await prisma.bookmark.findMany({
    where: { chromeProfileId: profileId },
  });
  const existingByChromeId = new Map(existingBookmarks.map((b) => [b.chromeBookmarkId, b]));

  const changes: TrackedChange[] = [];
  let importedCount = 0;

  for (const bm of orderedBookmarks) {
    const normalized = normalizeUrl(bm.url);
    if (!normalized) continue;

    const website = await prisma.website.upsert({
      where: { normalizedUrl: normalized.normalizedUrl },
      create: { normalizedUrl: normalized.normalizedUrl, domain: normalized.domain },
      update: {},
    });

    const folderId = bm.parentChromeFolderId
      ? chromeFolderIdToDbId.get(bm.parentChromeFolderId) ?? null
      : null;

    const isDup = isDuplicate(keepers, normalized.normalizedUrl, bm.chromeBookmarkId);
    if (!isDup) keepers.set(normalized.normalizedUrl, bm.chromeBookmarkId);

    const existing = existingByChromeId.get(bm.chromeBookmarkId);
    const title = bm.title || normalized.domain;

    // A manual "Remove from Organizer" (isDeleted with isDuplicate=false)
    // must survive a re-sync just like a duplicate suppression does —
    // otherwise every full re-import silently undoes it.
    const manuallyRemoved = existing?.isDeleted === true && existing.isDuplicate === false;
    const finalIsDeleted = manuallyRemoved ? true : isDup;
    const finalIsDuplicate = manuallyRemoved ? false : isDup;

    if (!existing) {
      changes.push({
        chromeBookmarkId: bm.chromeBookmarkId,
        action: "created",
        previousIsDeleted: null,
        previousIsDuplicate: null,
        newIsDeleted: finalIsDeleted,
        newIsDuplicate: finalIsDuplicate,
        title,
        url: bm.url,
      });
    } else if (existing.isDeleted !== finalIsDeleted || existing.isDuplicate !== finalIsDuplicate) {
      changes.push({
        chromeBookmarkId: bm.chromeBookmarkId,
        action: !existing.isDeleted && finalIsDeleted ? "suppressed_duplicate" : "unsuppressed",
        previousIsDeleted: existing.isDeleted,
        previousIsDuplicate: existing.isDuplicate,
        newIsDeleted: finalIsDeleted,
        newIsDuplicate: finalIsDuplicate,
        title,
        url: bm.url,
      });
    }

    await prisma.bookmark.upsert({
      where: {
        chromeProfileId_chromeBookmarkId: {
          chromeProfileId: profileId,
          chromeBookmarkId: bm.chromeBookmarkId,
        },
      },
      create: {
        chromeProfileId: profileId,
        chromeBookmarkId: bm.chromeBookmarkId,
        folderId,
        websiteId: website.id,
        chromeTitle: title,
        url: bm.url,
        domain: normalized.domain,
        dateAdded: new Date(bm.dateAdded),
        position: bm.index,
        isDeleted: finalIsDeleted,
        isDuplicate: finalIsDuplicate,
      },
      update: {
        folderId,
        chromeTitle: title,
        url: bm.url,
        domain: normalized.domain,
        position: bm.index,
        isDeleted: finalIsDeleted,
        isDuplicate: finalIsDuplicate,
      },
    });
    importedCount++;
  }

  // A full re-import is authoritative for "what currently exists in
  // Chrome" — anything still marked active in our DB that didn't appear in
  // this fresh tree dump was removed in Chrome (possibly while the
  // extension wasn't running to catch a live onRemoved event) and needs to
  // be reconciled away here too. Guarded against an empty/broken payload
  // wiping out the whole library.
  if (bookmarks.length > 0) {
    const incomingIds = new Set(bookmarks.map((bm) => bm.chromeBookmarkId));
    const goneFromChrome = existingBookmarks.filter(
      (b) => !b.isDeleted && !incomingIds.has(b.chromeBookmarkId),
    );

    if (goneFromChrome.length > 0) {
      await prisma.bookmark.updateMany({
        where: { id: { in: goneFromChrome.map((b) => b.id) } },
        data: { isDeleted: true },
      });
      for (const b of goneFromChrome) {
        changes.push({
          chromeBookmarkId: b.chromeBookmarkId,
          action: "removed",
          previousIsDeleted: false,
          previousIsDuplicate: false,
          newIsDeleted: true,
          newIsDuplicate: false,
          title: b.chromeTitle,
          url: b.url,
        });
      }
    }
  }

  await prisma.chromeProfile.update({
    where: { id: profileId },
    data: { connectionStatus: "synced", lastSyncedAt: new Date() },
  });

  await recordSyncLog(profileId, "full_import", changes);

  // Fire-and-forget: cards must render immediately, enrichment fills in after (PRD §33).
  void runEnrichmentPass();

  return NextResponse.json({
    importedBookmarks: importedCount,
    importedFolders: folders.length,
  });
}
