import { prisma } from "./db";
import { extractMetadata, pickMetadataThumbnail, type ThumbnailSource } from "./metadata";
import { captureScreenshot } from "./screenshot";

const CONCURRENCY = 12;
let running = false;

// Websites the UI has recently asked to see (i.e. someone is looking at a
// folder/search result right now) jump ahead of the plain import-order
// queue — otherwise a large import processed strictly oldest-first can
// leave whatever folder you're actually viewing waiting behind thousands
// of others you're not looking at.
const priorityIds = new Set<string>();

export function prioritizeWebsites(ids: string[]) {
  for (const id of ids) priorityIds.add(id);
  void runEnrichmentPass();
}

/**
 * Processes pending Website rows in-process (no external queue for the
 * local MVP). PRD §33: import/display must never block on this — callers
 * fire-and-forget this function after writing bookmarks.
 */
export async function runEnrichmentPass() {
  if (running) return;
  running = true;
  try {
    let batch = await claimBatch();
    while (batch.length > 0) {
      await Promise.all(batch.map(processWebsite));
      batch = await claimBatch();
    }
  } finally {
    running = false;
  }
}

// "failed" is deliberately excluded from the routine sweep: a handful of
// dead/blocked URLs (a bookmarked localhost link, a site refusing headless
// browsers, etc.) fail almost instantly and — since they sort first by
// createdAt once every *new* pending site is exhausted, then keep sorting
// first again the instant they're reclaimed — would otherwise get retried
// on every single batch forever, starving every untried "pending" site of
// a turn. Failed sites only get reprocessed via an explicit retry (see
// POST /api/metadata/enrich), which flips them back to "pending" itself.
// "processing" IS auto-reclaimed here because runEnrichmentPass's `running`
// guard means only one pass ever executes per process — the only way a row
// is left stuck in "processing" is a server restart mid-batch.
const CLAIMABLE_STATUSES = ["pending", "processing"] as const;

async function claimBatch() {
  const claimed: { id: string; normalizedUrl: string }[] = [];

  if (priorityIds.size > 0) {
    const prioritized = await prisma.website.findMany({
      where: { id: { in: [...priorityIds] } },
      take: CONCURRENCY,
    });
    for (const w of prioritized) priorityIds.delete(w.id);
    claimed.push(...prioritized);
  }

  if (claimed.length < CONCURRENCY) {
    const rest = await prisma.website.findMany({
      where: {
        metadataStatus: { in: [...CLAIMABLE_STATUSES] },
        id: { notIn: claimed.map((w) => w.id) },
      },
      take: CONCURRENCY - claimed.length,
      orderBy: { createdAt: "asc" },
    });
    claimed.push(...rest);
  }

  if (claimed.length === 0) return [];
  await prisma.website.updateMany({
    where: { id: { in: claimed.map((w) => w.id) } },
    data: { metadataStatus: "processing", thumbnailStatus: "processing" },
  });
  return claimed;
}

async function processWebsite(website: { id: string; normalizedUrl: string }) {
  const meta = await extractMetadata(website.normalizedUrl);

  let thumbnailUrl: string | null = null;
  let thumbnailSource: ThumbnailSource = "placeholder";

  const metaThumbnail = pickMetadataThumbnail(meta);
  if (metaThumbnail) {
    thumbnailUrl = metaThumbnail.thumbnailUrl;
    thumbnailSource = metaThumbnail.thumbnailSource;
  } else {
    const screenshot = await captureScreenshot(website.normalizedUrl);
    if (screenshot) {
      thumbnailUrl = screenshot;
      thumbnailSource = "screenshot";
    } else if (meta?.favicon) {
      thumbnailUrl = meta.favicon;
      thumbnailSource = "favicon";
    }
  }

  await prisma.website.update({
    where: { id: website.id },
    data: {
      metaTitle: meta?.metaTitle ?? null,
      metaDescription: meta?.metaDescription ?? null,
      descriptionSource: meta?.descriptionSource ?? "none",
      ogTitle: meta?.ogTitle ?? null,
      ogDescription: meta?.ogDescription ?? null,
      ogImage: meta?.ogImage ?? null,
      twitterImage: meta?.twitterImage ?? null,
      siteName: meta?.siteName ?? null,
      favicon: meta?.favicon ?? null,
      canonicalUrl: meta?.canonicalUrl ?? null,
      thumbnailUrl,
      thumbnailSource,
      metadataStatus: meta ? "complete" : "failed",
      thumbnailStatus: thumbnailUrl ? "complete" : "failed",
      lastFetchedAt: new Date(),
    },
  });
}
