import { prisma } from "./db";

/**
 * Loads a normalizedUrl → chromeBookmarkId map of every currently-active
 * ("real", non-duplicate) bookmark in a profile. Used to decide whether an
 * incoming bookmark (from a full re-import or a live "created" event) is an
 * exact-URL duplicate of something already kept.
 */
export async function loadActiveKeepers(profileId: string): Promise<Map<string, string>> {
  const active = await prisma.bookmark.findMany({
    where: { chromeProfileId: profileId, isDeleted: false },
    include: { website: true },
  });
  const keepers = new Map<string, string>();
  for (const b of active) {
    if (b.website) keepers.set(b.website.normalizedUrl, b.chromeBookmarkId);
  }
  return keepers;
}

/**
 * True when `normalizedUrl` already has an active keeper that isn't this
 * exact Chrome bookmark (i.e. a different bookmark, same URL).
 */
export function isDuplicate(
  keepers: Map<string, string>,
  normalizedUrl: string,
  chromeBookmarkId: string,
): boolean {
  const keeperId = keepers.get(normalizedUrl);
  return keeperId !== undefined && keeperId !== chromeBookmarkId;
}
