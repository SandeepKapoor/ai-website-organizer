import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runEnrichmentPass } from "@/lib/enrichment";

// POST /api/metadata/enrich — retries any pending/failed websites.
// Used by the UI to recover from transient failures (PRD §34, acceptance
// criteria "a failed enrichment job can be retried").
//
// Body: { retryFallbackThumbnails?: boolean } — also re-queues websites
// that only ever got a favicon/placeholder thumbnail, so they get a chance
// at a real screenshot once that capability is added/enabled.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body?.retryFallbackThumbnails) {
    await prisma.website.updateMany({
      where: { thumbnailSource: { in: ["favicon", "placeholder"] } },
      data: { metadataStatus: "pending", thumbnailStatus: "pending" },
    });
  }
  void runEnrichmentPass();
  return NextResponse.json({ started: true });
}

// GET reports aggregate enrichment progress for the import/progress UI.
export async function GET() {
  const [pending, processing, complete, failed] = await Promise.all([
    prisma.website.count({ where: { metadataStatus: "pending" } }),
    prisma.website.count({ where: { metadataStatus: "processing" } }),
    prisma.website.count({ where: { metadataStatus: "complete" } }),
    prisma.website.count({ where: { metadataStatus: "failed" } }),
  ]);
  return NextResponse.json({ pending, processing, complete, failed });
}
