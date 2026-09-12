"use client";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renders `text` with every case-insensitive occurrence of `query` wrapped
 * in <mark> — so when you search "curate" you can actually see where it
 * shows up in each result's description, not just that it matched.
 */
export function HighlightMatch({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;

  const trimmedQuery = query.trim().toLowerCase();
  const pattern = new RegExp(`(${escapeRegExp(query.trim())})`, "gi");
  const parts = text.split(pattern);
  if (parts.length === 1) return <>{text}</>;

  // split() with a single capturing group puts each match at an odd index,
  // interspersed with the surrounding non-matching text at even indices.
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmedQuery ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200 px-0.5 text-neutral-900 dark:bg-yellow-500/40 dark:text-white"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
