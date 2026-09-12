import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Browser } from "playwright";

const SCREENSHOT_DIR = path.join(process.cwd(), "public", "screenshots");
const NAV_TIMEOUT_MS = 8000;

// A single shared browser instance for the life of the dev server process —
// launching Chromium per screenshot would be far too slow across hundreds
// of pending bookmarks.
//
// This is stored on `globalThis` (same trick as lib/db.ts's Prisma client)
// rather than a plain module-level variable: Next.js dev mode hot-reloads
// this module on every edit, which would otherwise re-run `let
// browserPromise = null` and launch a brand-new Chromium process every
// time a file changes — while the previous browser (and all of its
// renderer/gpu/utility subprocesses) is never closed and leaks forever.
const globalForBrowser = globalThis as unknown as { screenshotBrowser?: Promise<Browser> };

async function getBrowser(): Promise<Browser> {
  if (!globalForBrowser.screenshotBrowser) {
    const { chromium } = await import("playwright");
    globalForBrowser.screenshotBrowser = chromium.launch({ headless: true });
  }
  return globalForBrowser.screenshotBrowser;
}

async function closeBrowser() {
  if (!globalForBrowser.screenshotBrowser) return;
  const browser = await globalForBrowser.screenshotBrowser;
  globalForBrowser.screenshotBrowser = undefined;
  await browser.close().catch(() => undefined);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void closeBrowser().finally(() => process.exit(0));
  });
}

// Only a couple of pages render at once — full page rendering is much
// heavier than the plain HTTP metadata fetch, so this pool is deliberately
// smaller than the metadata-enrichment concurrency.
const MAX_CONCURRENT_PAGES = 6;
let activePages = 0;
const waiters: (() => void)[] = [];

async function acquireSlot() {
  if (activePages < MAX_CONCURRENT_PAGES) {
    activePages++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  activePages++;
}

function releaseSlot() {
  activePages--;
  const next = waiters.shift();
  if (next) next();
}

/**
 * Renders `pageUrl` headlessly and saves a JPEG screenshot to
 * public/screenshots, returning the path the frontend can load directly.
 * Used as a visual fallback when a site has no og:image/twitter:image
 * (PRD §17 priority 4). Returns null on any failure — callers fall back
 * further down the thumbnail chain.
 */
export async function captureScreenshot(pageUrl: string): Promise<string | null> {
  await acquireSlot();
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      // Smaller than a real viewport on purpose: these render into a small
      // card thumbnail, so there's no reason to ship full-desktop-res JPEGs
      // over the wire to every client.
      viewport: { width: 960, height: 600 },
      userAgent:
        "Mozilla/5.0 (compatible; AIWebsiteOrganizer/1.0; +local-mvp) AppleWebKit/537.36",
    });
    const page = await context.newPage();
    try {
      // "load" stalls the full timeout on ad/tracker-heavy sites that never
      // fully settle; domcontentloaded resolves promptly for nearly every
      // site, and a short fixed wait lets above-the-fold assets paint.
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      await page.waitForTimeout(600);
      const buffer = await page.screenshot({ type: "jpeg", quality: 60 });

      const filename = `${createHash("sha256").update(pageUrl).digest("hex")}.jpg`;
      await mkdir(SCREENSHOT_DIR, { recursive: true });
      await writeFile(path.join(SCREENSHOT_DIR, filename), buffer);

      return `/screenshots/${filename}`;
    } finally {
      await context.close();
    }
  } catch {
    return null;
  } finally {
    releaseSlot();
  }
}
