// Deterministic keyword-based category badge for each bookmark card.
// PRD §48 calls this "AI categorization" and marks it as a later phase —
// this is the heuristic version: it only looks at text/domain already
// scraped, no model call, so the same input always produces the same
// label. Every bookmark gets *some* badge (see FALLBACK_LABEL at the
// bottom) since this personal library spans far more than design/dev
// content — crypto, travel, jobs, music, courses, etc.

// Checked first and take priority over keyword rules: a well-known domain
// is a much stronger, more precise signal than any text match.
const DOMAIN_RULES: { label: string; domains: string[] }[] = [
  { label: "Video", domains: ["youtube.com", "youtu.be", "vimeo.com", "netflix.com", "hotstar.com", "twitch.tv"] },
  { label: "Music", domains: ["spotify.com", "soundcloud.com", "music.apple.com", "music.youtube.com"] },
  {
    label: "Social Media",
    domains: ["twitter.com", "x.com", "instagram.com", "facebook.com", "threads.net", "reddit.com", "tiktok.com", "pinterest.com"],
  },
  { label: "Jobs", domains: ["indeed.com", "glassdoor.com", "naukri.com", "linkedin.com/jobs", "wellfound.com"] },
  { label: "Finance", domains: ["coinbase.com", "binance.com", "coinmarketcap.com", "coingecko.com", "tradingview.com"] },
  { label: "Travel", domains: ["booking.com", "airbnb.com", "tripadvisor.com", "skyscanner.com", "makemytrip.com"] },
  { label: "E-commerce", domains: ["amazon.", "flipkart.com", "myntra.com", "ebay.com", "etsy.com", "shopify.com"] },
  { label: "Course", domains: ["coursera.org", "udemy.com", "skillshare.com", "edx.org", "khanacademy.org"] },
  { label: "Reference", domains: ["wikipedia.org", "wiktionary.org"] },
  { label: "Blog", domains: ["medium.com", "substack.com", "dev.to", "hashnode.com"] },
  { label: "Productivity", domains: ["notion.so", "trello.com", "asana.com", "todoist.com", "linear.app"] },
  { label: "Developer Tool", domains: ["github.com", "gitlab.com", "stackoverflow.com", "npmjs.com", "vercel.com"] },
  { label: "Design Resource", domains: ["figma.com", "dribbble.com", "behance.net", "awwwards.com"] },
];

const KEYWORD_RULES: { label: string; keywords: string[] }[] = [
  // Deliberately narrow, multi-word phrases only — a bare " ai " match is
  // far too common in 2026 tech copy (nearly everything "uses AI" somewhere
  // in its description) and was swallowing unrelated categories entirely.
  {
    label: "AI Tool",
    keywords: [
      "ai-powered",
      "artificial intelligence",
      "chatgpt",
      "generative ai",
      "ai agent",
      "ai copilot",
      "ai assistant",
      "large language model",
      "machine learning model",
      "openai",
      "anthropic claude",
    ],
  },
  { label: "Developer Tool", keywords: ["api", "sdk", "cli tool", "open source", "npm package", "framework", "boilerplate", "documentation"] },
  { label: "Design Resource", keywords: ["ui kit", "design system", "mockup", "wireframe", "icon set", "component library", "design resource"] },
  { label: "Typography", keywords: ["typeface", "font", "typography", "type scale"] },
  { label: "Branding", keywords: ["brand identity", "branding", "logo design", "brand guideline"] },
  { label: "Portfolio", keywords: ["portfolio", "case study", "my work", "selected work"] },
  { label: "Agency", keywords: ["creative agency", "design agency", "digital agency", "studio based in", "we are a studio"] },
  { label: "E-commerce", keywords: ["shop now", "add to cart", "checkout", "free shipping", "e-commerce", "ecommerce"] },
  { label: "SaaS", keywords: ["pricing plan", "free trial", "sign up free", "saas", "subscription", "platform for teams"] },
  { label: "Dashboard", keywords: ["analytics dashboard", "admin dashboard", "dashboard template"] },
  { label: "Landing Page", keywords: ["landing page"] },
  { label: "Course", keywords: ["course", "tutorial", "learn to", "bootcamp", "masterclass", "lesson", "certification exam", "entrance exam"] },
  { label: "Community", keywords: ["community", "forum", "discord", "subreddit"] },
  { label: "Blog", keywords: ["blog", "newsletter", "articles about", "written by"] },
  { label: "News", keywords: ["breaking news", "latest news", "headlines"] },
  { label: "Reference", keywords: ["encyclopedia", "wiki", "definition of", "dictionary"] },
  { label: "Finance", keywords: ["cryptocurrency", "crypto", "stock market", "invest", "trading", "portfolio tracker"] },
  { label: "Travel", keywords: ["itinerary", "flight", "hotel booking", "visa", "things to do in", "travel guide"] },
  { label: "Jobs", keywords: ["job openings", "we're hiring", "hiring now", "resume", " cv ", "career opportunities"] },
  { label: "Music", keywords: ["playlist", "album", "lyrics", " song "] },
  { label: "Entertainment", keywords: ["watch online", "stream", "movies", "tv shows", "anime", "game", "play now"] },
  { label: "Productivity", keywords: ["productivity", "note-taking", "task management", "to-do", "workspace"] },
];

// Grammatical filler + generic marketing/CTA words to skip when nothing in
// KEYWORD_RULES matches. These are common enough (in nearly every title) to
// never be a useful, distinguishing badge on their own.
const SKIP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with", "by", "from", "as",
  "is", "are", "was", "were", "be", "been", "being", "it", "its", "this", "that", "these", "those",
  "your", "you", "we", "our", "us", "my", "me", "they", "their", "he", "she", "his", "her", "them",
  "not", "no", "yes", "do", "does", "did", "can", "could", "will", "would", "should", "has", "have", "had",
  "than", "then", "so", "if", "when", "where", "how", "what", "who", "which", "all", "any", "some",
  "more", "most", "one", "two", "into", "out", "up", "down", "over", "under", "about", "also", "just",
  "only", "very", "here", "there", "now", "today",
  "play", "watch", "get", "discover", "compare", "build", "create", "make", "find", "explore", "join",
  "start", "try", "download", "learn", "unlock", "boost", "streamline", "simplify", "welcome",
  "introducing", "best", "free", "official", "home", "site", "website", "app", "platform", "tool",
  "online", "easy", "simple", "powerful", "ultimate", "complete", "everything", "everywhere", "world", "new", "top",
]);

/**
 * Last-resort badge when no fixed category rule matches: pulls a real
 * word/phrase straight out of the site's own already-scraped title or
 * description (never invented text, same rule as the card description
 * itself), rather than a meaningless generic "Website" label.
 */
function extractFallbackLabel(title: string | null | undefined, description: string | null | undefined, domain: string | null | undefined): string {
  const words = [title, description]
    .filter(Boolean)
    .join(" ")
    .split(/[^A-Za-z']+/)
    .filter((w) => w.length > 2 && !SKIP_WORDS.has(w.toLowerCase()));

  if (words.length > 0) {
    const picked = words.slice(0, 2).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    return picked.join(" ").slice(0, 20);
  }

  const brand = (domain ?? "").split(".")[0];
  return brand ? brand[0].toUpperCase() + brand.slice(1).toLowerCase() : "Other";
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary regex per keyword, not plain substring matching — short
// keywords like "api" or "cli" would otherwise match inside unrelated words
// ("rapid", "client"), the same bug that made a bare "ai" swallow nearly
// every card into "AI Tool" regardless of what the site actually was.
const COMPILED_KEYWORD_RULES = KEYWORD_RULES.map((rule) => ({
  label: rule.label,
  patterns: rule.keywords.map((kw) => new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i")),
}));

export function categorize(text: {
  title?: string | null;
  description?: string | null;
  domain?: string | null;
}): string {
  const domain = (text.domain ?? "").toLowerCase();
  for (const rule of DOMAIN_RULES) {
    if (rule.domains.some((d) => domain.includes(d))) return rule.label;
  }

  const haystack = [text.title, text.description, text.domain].filter(Boolean).join(" ");
  for (const rule of COMPILED_KEYWORD_RULES) {
    if (rule.patterns.some((re) => re.test(haystack))) return rule.label;
  }

  return extractFallbackLabel(text.title, text.description, text.domain);
}

// One saturated color per category (kept in sync with the labels above) so
// badges are actually easy to distinguish/scan, instead of a single flat
// gray chip for every category.
const CATEGORY_COLORS: Record<string, string> = {
  "AI Tool": "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "Developer Tool": "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  "Design Resource": "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
  Typography: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Branding: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  Portfolio: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  Agency: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  "E-commerce": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  SaaS: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  Dashboard: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  "Landing Page": "bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-300",
  Course: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  Community: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  Blog: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  Entertainment: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  Productivity: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  Video: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  Music: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
  "Social Media": "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  Jobs: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  Finance: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  Travel: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  Reference: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300",
  News: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
};

const FALLBACK_COLOR = "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300";

export function categoryColorClass(category: string): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_COLOR;
}

// Solid, opaque variants for badges overlaid on top of a thumbnail image —
// a pastel background (like the chip variant above) can wash out or lose
// contrast against a busy screenshot, so these use a vivid solid fill with
// white text instead.
const CATEGORY_OVERLAY_COLORS: Record<string, string> = {
  "AI Tool": "bg-indigo-600/90 text-white",
  "Developer Tool": "bg-sky-600/90 text-white",
  "Design Resource": "bg-fuchsia-600/90 text-white",
  Typography: "bg-amber-600/90 text-white",
  Branding: "bg-rose-600/90 text-white",
  Portfolio: "bg-violet-600/90 text-white",
  Agency: "bg-orange-600/90 text-white",
  "E-commerce": "bg-emerald-600/90 text-white",
  SaaS: "bg-blue-600/90 text-white",
  Dashboard: "bg-cyan-600/90 text-white",
  "Landing Page": "bg-lime-600/90 text-white",
  Course: "bg-teal-600/90 text-white",
  Community: "bg-purple-600/90 text-white",
  Blog: "bg-pink-600/90 text-white",
  Entertainment: "bg-red-600/90 text-white",
  Productivity: "bg-green-600/90 text-white",
  Video: "bg-red-600/90 text-white",
  Music: "bg-fuchsia-600/90 text-white",
  "Social Media": "bg-sky-600/90 text-white",
  Jobs: "bg-slate-600/90 text-white",
  Finance: "bg-emerald-600/90 text-white",
  Travel: "bg-cyan-600/90 text-white",
  Reference: "bg-yellow-600/90 text-white",
  News: "bg-orange-600/90 text-white",
};

const FALLBACK_OVERLAY_COLOR = "bg-black/70 text-white";

export function categoryOverlayColorClass(category: string): string {
  return CATEGORY_OVERLAY_COLORS[category] ?? FALLBACK_OVERLAY_COLOR;
}
