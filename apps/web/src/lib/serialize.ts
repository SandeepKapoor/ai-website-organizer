import type { Bookmark, BookmarkFolder, Website } from "@prisma/client";
import { categorize } from "./categorize";
import type { BookmarkCardData } from "./types";

type BookmarkWithRelations = Bookmark & {
  website: Website | null;
  folder: BookmarkFolder | null;
};

export function serializeBookmark(bookmark: BookmarkWithRelations): BookmarkCardData {
  const website = bookmark.website;
  const title = website?.metaTitle ?? bookmark.chromeTitle;
  const description = website?.metaDescription ?? null;
  return {
    id: bookmark.id,
    // Website metadata title wins when available; Chrome title is the fallback (PRD §20).
    title,
    url: bookmark.url,
    domain: bookmark.domain,
    description,
    category: categorize({ title, description, domain: bookmark.domain }),
    thumbnailUrl: website?.thumbnailUrl ?? null,
    thumbnailSource: website?.thumbnailSource ?? "placeholder",
    favicon: website?.favicon ?? null,
    folderPath: bookmark.folder?.path ?? "",
    folderId: bookmark.folderId,
    dateAdded: bookmark.dateAdded.toISOString(),
    metadataStatus: website?.metadataStatus ?? "pending",
    thumbnailStatus: website?.thumbnailStatus ?? "pending",
  };
}
