"use client";

import type { BookmarkCardData } from "@/lib/types";
import { Card, LIST_GRID_COLS } from "./Card";
import type { ViewMode } from "./ViewToggle";

// PRD §22–24: responsive grid is the default; masonry uses CSS columns to
// respect each thumbnail's own aspect ratio; list is a dense single column.
export function CardGrid({
  bookmarks,
  view,
  onRemove,
  onQuickView,
  highlightQuery,
}: {
  bookmarks: BookmarkCardData[];
  view: ViewMode;
  onRemove?: (id: string) => void;
  onQuickView?: (bookmark: BookmarkCardData) => void;
  highlightQuery?: string;
}) {
  if (view === "list") {
    return (
      <div className="flex flex-col">
        <div
          className={`${LIST_GRID_COLS} gap-4 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:border-neutral-700`}
        >
          <span />
          <span>Website</span>
          <span>Category</span>
          <span />
        </div>
        {bookmarks.map((b) => (
          <Card
            key={b.id}
            bookmark={b}
            variant="list"
            onRemove={onRemove}
            onQuickView={onQuickView}
            highlightQuery={highlightQuery}
          />
        ))}
      </div>
    );
  }

  if (view === "masonry") {
    return (
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {bookmarks.map((b) => (
          <Card
            key={b.id}
            bookmark={b}
            variant="masonry"
            onRemove={onRemove}
            onQuickView={onQuickView}
            highlightQuery={highlightQuery}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {bookmarks.map((b) => (
        <Card
          key={b.id}
          bookmark={b}
          variant="grid"
          onRemove={onRemove}
          onQuickView={onQuickView}
          highlightQuery={highlightQuery}
        />
      ))}
    </div>
  );
}
