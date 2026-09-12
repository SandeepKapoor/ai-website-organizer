import * as cheerio from "cheerio";

export interface ExtractedMetadata {
  metaTitle: string | null;
  metaDescription: string | null;
  descriptionSource: "meta_description" | "og_description" | "other" | "none";
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterImage: string | null;
  siteName: string | null;
  favicon: string | null;
  canonicalUrl: string | null;
}

const FETCH_TIMEOUT_MS = 6000;

function resolveUrl(base: string, maybeRelative: string | undefined | null): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

/**
 * Fetches a page and extracts only metadata that actually exists in the
 * document. PRD §15: never invent or paraphrase a description — priority
 * order is meta description -> og:description -> other -> none.
 */
export async function extractMetadata(pageUrl: string): Promise<ExtractedMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AIWebsiteOrganizer/1.0; +local-mvp) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("text/html")) {
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const finalUrl = res.url || pageUrl;

    const get = (selector: string, attr: string) => {
      const val = $(selector).first().attr(attr);
      return val && val.trim().length > 0 ? val.trim() : null;
    };

    const titleTag = $("title").first().text().trim() || null;
    const metaDescription = get('meta[name="description"]', "content");
    const ogTitle = get('meta[property="og:title"]', "content");
    const ogDescription = get('meta[property="og:description"]', "content");
    const ogImage = get('meta[property="og:image"]', "content");
    const twitterImage = get('meta[name="twitter:image"]', "content");
    const siteName = get('meta[property="og:site_name"]', "content");
    const canonical = get('link[rel="canonical"]', "href");
    const iconHref =
      get('link[rel="icon"]', "href") ??
      get('link[rel="shortcut icon"]', "href") ??
      get('link[rel="apple-touch-icon"]', "href");

    let descriptionSource: ExtractedMetadata["descriptionSource"] = "none";
    let description: string | null = null;
    if (metaDescription) {
      description = metaDescription;
      descriptionSource = "meta_description";
    } else if (ogDescription) {
      description = ogDescription;
      descriptionSource = "og_description";
    }

    return {
      metaTitle: ogTitle ?? titleTag,
      metaDescription: description,
      descriptionSource,
      ogTitle,
      ogDescription,
      ogImage: resolveUrl(finalUrl, ogImage),
      twitterImage: resolveUrl(finalUrl, twitterImage),
      siteName,
      favicon: resolveUrl(finalUrl, iconHref) ?? resolveUrl(finalUrl, "/favicon.ico"),
      canonicalUrl: resolveUrl(finalUrl, canonical) ?? finalUrl,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export type ThumbnailSource = "og:image" | "twitter:image" | "screenshot" | "favicon" | "placeholder";

// Only the metadata-derived candidates. Screenshot capture requires a
// headless browser and lives in enrichment.ts, which calls this first and
// only falls through to a screenshot/favicon/placeholder when this returns
// null (PRD §17 priorities 1–2, then 4→3→5 — screenshot is tried before
// favicon here since a tiny icon makes a poor card thumbnail).
export function pickMetadataThumbnail(
  meta: ExtractedMetadata | null,
): { thumbnailUrl: string; thumbnailSource: ThumbnailSource } | null {
  if (meta?.ogImage) return { thumbnailUrl: meta.ogImage, thumbnailSource: "og:image" };
  if (meta?.twitterImage) return { thumbnailUrl: meta.twitterImage, thumbnailSource: "twitter:image" };
  return null;
}
