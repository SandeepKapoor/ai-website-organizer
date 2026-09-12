import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { runEnrichmentPass } from "@/lib/enrichment";
import { loadActiveKeepers, isDuplicate } from "@/lib/dedupe";
import { recordSyncLog, type TrackedChange } from "@/lib/syncLog";

interface SyncEvent {
  type:
    | "bookmark_created"
    | "bookmark_changed"
    | "bookmark_moved"
    | "bookmark_removed"
    | "folder_created"
    | "folder_changed"
    | "folder_moved"
    | "folder_removed";
  chromeBookmarkId?: string;
  chromeFolderId?: string;
  parentChromeFolderId?: string | null;
  name?: string;
  title?: string;
  url?: string;
  path?: string;
  index?: number;
  dateAdded?: number;
}

async function resolveFolderId(profileId: string, chromeFolderId: string | null | undefined) {
  if (!chromeFolderId) return null;
  const folder = await prisma.bookmarkFolder.findUnique({
    where: { chromeProfileId_chromeFolderId: { chromeProfileId: profileId, chromeFolderId } },
  });
  return folder?.id ?? null;
}

// POST /api/bookmarks/sync
// Incremental sync driven by chrome.bookmarks.on{Created,Changed,Moved,Removed}
// listeners in the extension background worker (PRD §12). Events are applied
// in the order the extension queued them.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const profileId = body?.profileId as string | undefined;
  const events = (body?.events ?? []) as SyncEvent[];

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const profile = await prisma.chromeProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    return NextResponse.json({ error: "Unknown profileId" }, { status: 404 });
  }

  let touchedWebsite = false;
  // Same exact-URL dedup rule as the full re-import: a brand new bookmark
  // that matches an already-active URL gets suppressed immediately instead
  // of ever showing up in the library.
  const keepers = await loadActiveKeepers(profileId);
  const changes: TrackedChange[] = [];

  for (const event of events) {
    switch (event.type) {
      case "folder_created":
      case "folder_changed":
      case "folder_moved": {
        if (!event.chromeFolderId) break;
        const parentFolderId = await resolveFolderId(profileId, event.parentChromeFolderId);
        await prisma.bookmarkFolder.upsert({
          where: {
            chromeProfileId_chromeFolderId: {
              chromeProfileId: profileId,
              chromeFolderId: event.chromeFolderId,
            },
          },
          create: {
            chromeProfileId: profileId,
            chromeFolderId: event.chromeFolderId,
            parentFolderId,
            name: event.name ?? "Untitled",
            path: event.path ?? event.name ?? "Untitled",
            position: event.index ?? 0,
          },
          update: {
            ...(event.name ? { name: event.name } : {}),
            ...(event.path ? { path: event.path } : {}),
            ...(event.index !== undefined ? { position: event.index } : {}),
            ...(event.type === "folder_moved" ? { parentFolderId } : {}),
          },
        });
        break;
      }
      case "folder_removed": {
        if (!event.chromeFolderId) break;
        await prisma.bookmarkFolder
          .delete({
            where: {
              chromeProfileId_chromeFolderId: {
                chromeProfileId: profileId,
                chromeFolderId: event.chromeFolderId,
              },
            },
          })
          .catch(() => undefined);
        break;
      }
      case "bookmark_created": {
        if (!event.chromeBookmarkId || !event.url) break;
        const normalized = normalizeUrl(event.url);
        if (!normalized) break;
        const website = await prisma.website.upsert({
          where: { normalizedUrl: normalized.normalizedUrl },
          create: { normalizedUrl: normalized.normalizedUrl, domain: normalized.domain },
          update: {},
        });
        const folderId = await resolveFolderId(profileId, event.parentChromeFolderId);
        const isDup = isDuplicate(keepers, normalized.normalizedUrl, event.chromeBookmarkId);
        if (!isDup) keepers.set(normalized.normalizedUrl, event.chromeBookmarkId);

        // A "created" event for an id we already know about is unusual, but
        // if it happens, a prior manual removal must still survive it, same
        // protection as the full re-import.
        const existing = await prisma.bookmark.findUnique({
          where: {
            chromeProfileId_chromeBookmarkId: {
              chromeProfileId: profileId,
              chromeBookmarkId: event.chromeBookmarkId,
            },
          },
        });
        const manuallyRemoved = existing?.isDeleted === true && existing.isDuplicate === false;
        const finalIsDeleted = manuallyRemoved ? true : isDup;
        const finalIsDuplicate = manuallyRemoved ? false : isDup;
        const title = event.title || normalized.domain;

        if (!existing) {
          changes.push({
            chromeBookmarkId: event.chromeBookmarkId,
            action: "created",
            previousIsDeleted: null,
            previousIsDuplicate: null,
            newIsDeleted: finalIsDeleted,
            newIsDuplicate: finalIsDuplicate,
            title,
            url: event.url,
          });
        } else if (existing.isDeleted !== finalIsDeleted || existing.isDuplicate !== finalIsDuplicate) {
          changes.push({
            chromeBookmarkId: event.chromeBookmarkId,
            action: !existing.isDeleted && finalIsDeleted ? "suppressed_duplicate" : "unsuppressed",
            previousIsDeleted: existing.isDeleted,
            previousIsDuplicate: existing.isDuplicate,
            newIsDeleted: finalIsDeleted,
            newIsDuplicate: finalIsDuplicate,
            title,
            url: event.url,
          });
        }

        await prisma.bookmark.upsert({
          where: {
            chromeProfileId_chromeBookmarkId: {
              chromeProfileId: profileId,
              chromeBookmarkId: event.chromeBookmarkId,
            },
          },
          create: {
            chromeProfileId: profileId,
            chromeBookmarkId: event.chromeBookmarkId,
            folderId,
            websiteId: website.id,
            chromeTitle: title,
            url: event.url,
            domain: normalized.domain,
            dateAdded: new Date(event.dateAdded ?? Date.now()),
            position: event.index ?? 0,
            isDeleted: finalIsDeleted,
            isDuplicate: finalIsDuplicate,
          },
          update: {
            folderId,
            chromeTitle: title,
            url: event.url,
            domain: normalized.domain,
            isDeleted: finalIsDeleted,
            isDuplicate: finalIsDuplicate,
          },
        });
        touchedWebsite = true;
        break;
      }
      case "bookmark_changed": {
        if (!event.chromeBookmarkId) break;
        const existing = await prisma.bookmark.findUnique({
          where: {
            chromeProfileId_chromeBookmarkId: {
              chromeProfileId: profileId,
              chromeBookmarkId: event.chromeBookmarkId,
            },
          },
        });
        if (!existing) break;

        let websiteId = existing.websiteId;
        let domain = existing.domain;
        // Editing the URL can change whether this is a duplicate in either
        // direction: it might now collide with something else (suppress
        // it), or it might have been a suppressed duplicate that's now
        // unique again (un-suppress it). A plain title/folder change leaves
        // isDeleted/isDuplicate untouched either way. A manual removal
        // (isDeleted with isDuplicate=false) is never overridden here.
        let isDeletedFlag = existing.isDeleted;
        let isDuplicateFlag = existing.isDuplicate;
        const manuallyRemoved = existing.isDeleted && !existing.isDuplicate;
        if (event.url && event.url !== existing.url) {
          const normalized = normalizeUrl(event.url);
          if (normalized) {
            const website = await prisma.website.upsert({
              where: { normalizedUrl: normalized.normalizedUrl },
              create: { normalizedUrl: normalized.normalizedUrl, domain: normalized.domain },
              update: {},
            });
            websiteId = website.id;
            domain = normalized.domain;
            touchedWebsite = true;

            if (!manuallyRemoved) {
              const dup = isDuplicate(keepers, normalized.normalizedUrl, event.chromeBookmarkId);
              isDeletedFlag = dup;
              isDuplicateFlag = dup;
              if (!dup) keepers.set(normalized.normalizedUrl, event.chromeBookmarkId);

              if (existing.isDeleted !== isDeletedFlag || existing.isDuplicate !== isDuplicateFlag) {
                changes.push({
                  chromeBookmarkId: event.chromeBookmarkId,
                  action: !existing.isDeleted && isDeletedFlag ? "suppressed_duplicate" : "unsuppressed",
                  previousIsDeleted: existing.isDeleted,
                  previousIsDuplicate: existing.isDuplicate,
                  newIsDeleted: isDeletedFlag,
                  newIsDuplicate: isDuplicateFlag,
                  title: event.title ?? existing.chromeTitle,
                  url: event.url,
                });
              }
            }
          }
        }

        await prisma.bookmark.update({
          where: { id: existing.id },
          data: {
            chromeTitle: event.title ?? existing.chromeTitle,
            url: event.url ?? existing.url,
            domain,
            websiteId,
            isDeleted: isDeletedFlag,
            isDuplicate: isDuplicateFlag,
          },
        });
        break;
      }
      case "bookmark_moved": {
        if (!event.chromeBookmarkId) break;
        const folderId = await resolveFolderId(profileId, event.parentChromeFolderId);
        await prisma.bookmark
          .update({
            where: {
              chromeProfileId_chromeBookmarkId: {
                chromeProfileId: profileId,
                chromeBookmarkId: event.chromeBookmarkId,
              },
            },
            data: { folderId, position: event.index ?? 0 },
          })
          .catch(() => undefined);
        break;
      }
      case "bookmark_removed": {
        if (!event.chromeBookmarkId) break;
        // PRD §12: removed from the active library, not hard-deleted immediately.
        const existing = await prisma.bookmark.findUnique({
          where: {
            chromeProfileId_chromeBookmarkId: {
              chromeProfileId: profileId,
              chromeBookmarkId: event.chromeBookmarkId,
            },
          },
        });
        if (!existing || existing.isDeleted) break;

        await prisma.bookmark.update({
          where: { id: existing.id },
          data: { isDeleted: true },
        });
        changes.push({
          chromeBookmarkId: event.chromeBookmarkId,
          action: "removed",
          previousIsDeleted: false,
          previousIsDuplicate: false,
          newIsDeleted: true,
          newIsDuplicate: false,
          title: existing.chromeTitle,
          url: existing.url,
        });
        break;
      }
    }
  }

  await prisma.chromeProfile.update({
    where: { id: profileId },
    data: { connectionStatus: "synced", lastSyncedAt: new Date() },
  });

  await recordSyncLog(profileId, "incremental", changes);

  if (touchedWebsite) void runEnrichmentPass();

  return NextResponse.json({ processed: events.length });
}
