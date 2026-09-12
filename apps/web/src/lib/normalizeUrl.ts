export function normalizeUrl(rawUrl: string): { normalizedUrl: string; domain: string } | null {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    // Strip a single trailing slash on bare-path URLs so
    // https://example.com/ and https://example.com match the same Website.
    if (url.pathname === "/") url.pathname = "";
    const normalizedUrl = url.toString();
    const domain = url.hostname.replace(/^www\./, "");
    return { normalizedUrl, domain };
  } catch {
    return null;
  }
}
