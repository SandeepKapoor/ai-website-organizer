import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/profiles/:id/sync-logs — recent sync history for a profile, most
// recent first, with a preview of individual changes for display.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const logs = await prisma.syncLog.findMany({
    where: { chromeProfileId: params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      changes: { take: 20, orderBy: { id: "asc" } },
      _count: { select: { changes: true } },
    },
  });

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      source: log.source,
      addedCount: log.addedCount,
      removedCount: log.removedCount,
      duplicateSuppressedCount: log.duplicateSuppressedCount,
      unsuppressedCount: log.unsuppressedCount,
      totalChanges: log._count.changes,
      restoredAt: log.restoredAt,
      changes: log.changes.map((c) => ({
        action: c.action,
        title: c.title,
        url: c.url,
      })),
    })),
  });
}
