import { PrismaClient } from "@prisma/client";
import { normalizeUrl } from "../src/lib/normalizeUrl";
import { runEnrichmentPass } from "../src/lib/enrichment";

const prisma = new PrismaClient();

const SAMPLE_URLS: { url: string; path: string[] }[] = [
  { url: "https://stripe.com", path: ["Bookmarks Bar", "Design", "SaaS"] },
  { url: "https://linear.app", path: ["Bookmarks Bar", "Design", "SaaS"] },
  { url: "https://vercel.com", path: ["Bookmarks Bar", "Design", "SaaS"] },
  { url: "https://www.figma.com", path: ["Bookmarks Bar", "Design", "Inspiration"] },
  { url: "https://dribbble.com", path: ["Bookmarks Bar", "Design", "Inspiration"] },
  { url: "https://www.awwwards.com", path: ["Bookmarks Bar", "Design", "Inspiration"] },
  { url: "https://fonts.google.com", path: ["Bookmarks Bar", "Design", "Typography"] },
  { url: "https://type-scale.com", path: ["Bookmarks Bar", "Design", "Typography"] },
  { url: "https://www.notion.so", path: ["Bookmarks Bar", "Resources"] },
  { url: "https://github.com", path: ["Bookmarks Bar", "Resources"] },
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "local@ai-website-organizer.app" },
    create: { email: "local@ai-website-organizer.app", name: "Local User" },
    update: {},
  });

  const profile = await prisma.chromeProfile.upsert({
    where: { id: "seed-profile" },
    create: {
      id: "seed-profile",
      userId: user.id,
      profileName: "Personal (sample data)",
      connectionStatus: "synced",
      lastSyncedAt: new Date(),
    },
    update: { lastSyncedAt: new Date() },
  });

  const folderCache = new Map<string, string>();

  async function ensureFolderPath(pathParts: string[]) {
    let parentId: string | null = null;
    let pathSoFar = "";
    for (const part of pathParts) {
      pathSoFar = pathSoFar ? `${pathSoFar} / ${part}` : part;
      const key = pathSoFar;
      if (folderCache.has(key)) {
        parentId = folderCache.get(key)!;
        continue;
      }
      const chromeFolderId = `seed-${key}`;
      const folder = await prisma.bookmarkFolder.upsert({
        where: {
          chromeProfileId_chromeFolderId: { chromeProfileId: profile.id, chromeFolderId },
        },
        create: {
          chromeProfileId: profile.id,
          chromeFolderId,
          parentFolderId: parentId,
          name: part,
          path: pathSoFar,
          position: 0,
        },
        update: { parentFolderId: parentId, name: part, path: pathSoFar },
      });
      folderCache.set(key, folder.id);
      parentId = folder.id;
    }
    return parentId;
  }

  let index = 0;
  for (const item of SAMPLE_URLS) {
    const folderId = await ensureFolderPath(item.path);
    const normalized = normalizeUrl(item.url);
    if (!normalized) continue;

    const website = await prisma.website.upsert({
      where: { normalizedUrl: normalized.normalizedUrl },
      create: { normalizedUrl: normalized.normalizedUrl, domain: normalized.domain },
      update: {},
    });

    await prisma.bookmark.upsert({
      where: {
        chromeProfileId_chromeBookmarkId: {
          chromeProfileId: profile.id,
          chromeBookmarkId: `seed-${index}`,
        },
      },
      create: {
        chromeProfileId: profile.id,
        chromeBookmarkId: `seed-${index}`,
        folderId,
        websiteId: website.id,
        chromeTitle: normalized.domain,
        url: item.url,
        domain: normalized.domain,
        dateAdded: new Date(),
        position: index,
      },
      update: {},
    });
    index++;
  }

  console.log(`Seeded ${index} sample bookmarks. Running metadata enrichment...`);
  await runEnrichmentPass();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
