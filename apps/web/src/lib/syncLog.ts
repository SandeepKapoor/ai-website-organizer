import { prisma } from "./db";

export type SyncChangeAction = "created" | "removed" | "suppressed_duplicate" | "unsuppressed";

export interface TrackedChange {
  chromeBookmarkId: string;
  action: SyncChangeAction;
  previousIsDeleted: boolean | null;
  previousIsDuplicate: boolean | null;
  newIsDeleted: boolean;
  newIsDuplicate: boolean;
  title: string;
  url: string;
}

/**
 * Records one history entry for a sync call, but only when something
 * actually changed — a routine resync where nothing moved doesn't clutter
 * the history. This is what Settings > Profiles reads to show "what changed
 * last sync" and to power the restore button.
 */
export async function recordSyncLog(
  chromeProfileId: string,
  source: "full_import" | "incremental",
  changes: TrackedChange[],
) {
  if (changes.length === 0) return;

  const addedCount = changes.filter((c) => c.action === "created").length;
  const removedCount = changes.filter((c) => c.action === "removed").length;
  const duplicateSuppressedCount = changes.filter((c) => c.action === "suppressed_duplicate").length;
  const unsuppressedCount = changes.filter((c) => c.action === "unsuppressed").length;

  await prisma.syncLog.create({
    data: {
      chromeProfileId,
      source,
      addedCount,
      removedCount,
      duplicateSuppressedCount,
      unsuppressedCount,
      changes: {
        create: changes.map((c) => ({
          chromeBookmarkId: c.chromeBookmarkId,
          action: c.action,
          previousIsDeleted: c.previousIsDeleted,
          previousIsDuplicate: c.previousIsDuplicate,
          newIsDeleted: c.newIsDeleted,
          newIsDuplicate: c.newIsDuplicate,
          title: c.title,
          url: c.url,
        })),
      },
    },
  });
}
