// Deterministic keyword → emoji lookup for top-level folder categories.
// Not AI-generated per PRD §15's spirit — a fixed rule table, same input
// always gives the same output, purely a navigation aid.
const RULES: { emoji: string; keywords: string[] }[] = [
  { emoji: "🎨", keywords: ["design", "graphic"] },
  { emoji: "🖌️", keywords: ["illustration", "illustrat"] },
  { emoji: "🧊", keywords: ["3d", "render"] },
  { emoji: "✍️", keywords: ["blog", "writing", "article"] },
  { emoji: "🧠", keywords: ["hci", "ux research", "psycholog", "cognit"] },
  { emoji: "🤖", keywords: ["ai ", " ai", "machine learning", "ml ", "workshop"] },
  { emoji: "💼", keywords: ["portfolio", "resume", "cv "] },
  { emoji: "🛠️", keywords: ["tool", "utilit", "resource"] },
  { emoji: "💡", keywords: ["inspir", "inspo", "idea"] },
  { emoji: "📚", keywords: ["case stud", "study", "learn", "course", "tutorial"] },
  { emoji: "🚀", keywords: ["project", "launch", "startup"] },
  { emoji: "🧑‍🏫", keywords: ["mentor", "review", "feedback"] },
  { emoji: "✅", keywords: ["tip", "checklist", "guide"] },
  { emoji: "🔤", keywords: ["typograph", "font"] },
  { emoji: "🏷️", keywords: ["brand", "logo"] },
  { emoji: "🎬", keywords: ["motion", "animation", "video", "film"] },
  { emoji: "📈", keywords: ["saas", "startup", "growth", "marketing"] },
  { emoji: "💻", keywords: ["dev", "code", "coding", "engineer", "programming"] },
  { emoji: "🛒", keywords: ["ecommerce", "shop", "store", "commerce"] },
  { emoji: "📷", keywords: ["photo", "camera"] },
  { emoji: "🎵", keywords: ["music", "audio", "sound"] },
  { emoji: "💰", keywords: ["finance", "invest", "money", "budget"] },
  { emoji: "✈️", keywords: ["travel", "trip"] },
  { emoji: "🍔", keywords: ["food", "recipe", "cook"] },
  { emoji: "🏥", keywords: ["health", "fitness", "medical", "wellness"] },
  { emoji: "📰", keywords: ["news", "press"] },
  { emoji: "🗣️", keywords: ["social", "community"] },
  { emoji: "🎓", keywords: ["university", "school", "education", "academ"] },
  { emoji: "🎮", keywords: ["game", "gaming"] },
  { emoji: "🏛️", keywords: ["architect", "interior"] },
  { emoji: "👗", keywords: ["fashion", "apparel", "style"] },
  { emoji: "🏠", keywords: ["real estate", "property", "home"] },
  { emoji: "💼", keywords: ["work", "job", "career"] },
  { emoji: "👤", keywords: ["personal"] },
  { emoji: "🖇️", keywords: ["freelance", "client"] },
  { emoji: "🌐", keywords: ["web"] },
  { emoji: "🏢", keywords: ["business", "employ", "agency", "startup", "company"] },
  { emoji: "💹", keywords: ["crypto", "stock", "trading"] },
  { emoji: "🧩", keywords: ["misc", "other", "general"] },
];

// Every top-level folder should show something — this is a purely
// decorative navigation aid, and a folder silently missing an icon while
// its siblings all have one reads as broken rather than just "no match".
const FALLBACK_EMOJI = "📁";

// Some real Chrome folder names already start with their own emoji (people
// often add these by hand when organizing bookmarks) — in that case adding
// another one on top would show two icons back to back, so this is checked
// before falling back (or even before a keyword match) to avoid doubling up.
const LEADING_EMOJI_RE = /^\p{Extended_Pictographic}/u;

export function getFolderEmoji(name: string): string {
  const trimmed = name.trim();
  if (LEADING_EMOJI_RE.test(trimmed)) return "";

  const normalized = ` ${trimmed.toLowerCase()} `;
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule.emoji;
    }
  }
  return FALLBACK_EMOJI;
}
