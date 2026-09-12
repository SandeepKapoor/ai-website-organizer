import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { serializeBookmark } from "./serialize";
import { prioritizeWebsites } from "./enrichment";
import type { BookmarkCardData } from "./types";

export interface QueryBookmarksOptions {
  folderId?: string | null;
  includeDescendants?: boolean;
  q?: string | null;
  domain?: string | null;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface QueryBookmarksResult {
  bookmarks: BookmarkCardData[];
  total: number;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 60;
const MAX_PAGE_SIZE = 200;

export async function queryBookmarks(opts: QueryBookmarksOptions): Promise<QueryBookmarksResult> {
  const where: Prisma.BookmarkWhereInput = { isDeleted: false };

  if (opts.domain) where.domain = opts.domain;

  if (opts.folderId) {
    if (opts.includeDescendants ?? true) {
      const folderIds = await collectDescendantFolderIds(opts.folderId);
      where.folderId = { in: folderIds };
    } else {
      where.folderId = opts.folderId;
    }
  }

  if (opts.q) {
    const q = opts.q;
    where.OR = [
      { chromeTitle: { contains: q } },
      { url: { contains: q } },
      { domain: { contains: q } },
      { website: { metaTitle: { contains: q } } },
      { website: { metaDescription: { contains: q } } },
      { folder: { path: { contains: q } } },
    ];
  }

  const orderBy: Prisma.BookmarkOrderByWithRelationInput[] = (() => {
    switch (opts.sort) {
      case "recently_updated":
        return [{ updatedAt: "desc" }];
      // Sorts by domain, not the raw Chrome bookmark title — the domain is
      // what's actually shown as the card's bold primary line (see
      // Card.tsx), so that's what needs to visibly read A→Z. Sorting by
      // title instead would look "wrong" even though it was technically
      // sorted, just not by the text on screen.
      case "alphabetical":
      case "domain":
        return [{ domain: "asc" }];
      case "folder":
        return [{ folder: { path: "asc" } }];
      // The manual order the bookmarks were arranged in within Chrome
      // itself (Bookmark.position, captured at import/sync time) — grouped
      // by folder first so a folder view that pulls in descendants doesn't
      // interleave unrelated subfolders' items together.
      case "folder_order":
        return [{ folder: { path: "asc" } }, { position: "asc" }];
      case "recently_added":
      default:
        return [{ dateAdded: "desc" }];
    }
  })();

  const limit = Math.min(opts.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = opts.offset ?? 0;

  // Rendering thousands of image cards in one unpaginated DOM is what made
  // the app feel slow once real thumbnails replaced placeholders — every
  // view (including "All Bookmarks") is now paged, so only one screenful of
  // cards/images ever exists in the DOM at a time regardless of library size.
  const [bookmarks, total] = await Promise.all([
    prisma.bookmark.findMany({
      where,
      orderBy,
      include: { website: true, folder: true },
      skip: offset,
      take: limit,
    }),
    prisma.bookmark.count({ where }),
  ]);

  // Scoped views (a specific folder, or a search) mean someone is looking
  // right at these results, so whatever's on this page should jump the
  // enrichment queue instead of waiting behind the rest of a large import
  // (see enrichment.ts's priorityIds).
  if (opts.folderId || opts.q) {
    const pendingIds = bookmarks
      .filter((b) => b.website && b.website.metadataStatus !== "complete")
      .map((b) => b.website!.id);
    if (pendingIds.length > 0) prioritizeWebsites(pendingIds);
  }

  return {
    bookmarks: bookmarks.map(serializeBookmark),
    total,
    hasMore: offset + bookmarks.length < total,
  };
}

async function collectDescendantFolderIds(rootFolderId: string): Promise<string[]> {
  const all = await prisma.bookmarkFolder.findMany({
    select: { id: true, parentFolderId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const f of all) {
    if (!f.parentFolderId) continue;
    const list = childrenByParent.get(f.parentFolderId) ?? [];
    list.push(f.id);
    childrenByParent.set(f.parentFolderId, list);
  }

  const result: string[] = [rootFolderId];
  const queue = [rootFolderId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const child of childrenByParent.get(current) ?? []) {
      result.push(child);
      queue.push(child);
    }
  }
  return result;
}
