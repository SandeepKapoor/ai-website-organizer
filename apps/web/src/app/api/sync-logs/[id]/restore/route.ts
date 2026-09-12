import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/sync-logs/:id/restore — undoes every tracked change from one
// sync: a "created" bookmark is deleted (it didn't exist before that sync),
// everything else (removed / suppressed_duplicate / unsuppressed) reverts
// to its previous isDeleted/isDuplicate state.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const log = await prisma.syncLog.findUnique({
    where: { id: params.id },
    include: { changes: true },
  });

  if (!log) {
    return NextResponse.json({ error: "Sync log not found" }, { status: 404 });
  }
  if (log.restoredAt) {
    return NextResponse.json({ error: "Already restored" }, { status: 409 });
  }

  let restoredCount = 0;

  for (const change of log.changes) {
    const where = {
      chromeProfileId_chromeBookmarkId: {
        chromeProfileId: log.chromeProfileId,
        chromeBookmarkId: change.chromeBookmarkId,
      },
    };

    if (change.action === "created") {
      // Didn't exist before this sync — undoing it means it shouldn't exist now.
      await prisma.bookmark.delete({ where }).catch(() => undefined);
      restoredCount++;
    } else if (change.previousIsDeleted !== null && change.previousIsDuplicate !== null) {
      await prisma.bookmark
        .update({
          where,
          data: { isDeleted: change.previousIsDeleted, isDuplicate: change.previousIsDuplicate },
        })
        .catch(() => undefined);
      restoredCount++;
    }
  }

  await prisma.syncLog.update({
    where: { id: log.id },
    data: { restoredAt: new Date() },
  });

  return NextResponse.json({ restoredCount });
}
