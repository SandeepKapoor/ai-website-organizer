"use client";

const PALETTES = [
  ["#f5f5f4", "#78716c"],
  ["#f0f9ff", "#0284c7"],
  ["#fdf4ff", "#a21caf"],
  ["#fefce8", "#a16207"],
  ["#f0fdf4", "#15803d"],
  ["#fff1f2", "#be123c"],
];

function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[hash % PALETTES.length];
}

// PRD §17 priority 5 / §44: never show a broken image — a clean generated
// placeholder with the domain initials always renders instead.
export function ThumbnailPlaceholder({ domain, title }: { domain: string; title: string }) {
  const [bg, fg] = paletteFor(domain);
  const initial = (title || domain || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span className="text-4xl font-semibold">{initial}</span>
      <span className="text-xs font-medium opacity-80">{domain}</span>
    </div>
  );
}
