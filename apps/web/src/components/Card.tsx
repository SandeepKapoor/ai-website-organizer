"use client";

import { useState } from "react";
import Link from "next/link";
import type { BookmarkCardData } from "@/lib/types";
import { categoryColorClass, categoryOverlayColorClass } from "@/lib/categorize";
import { ThumbnailPlaceholder } from "./ThumbnailPlaceholder";
import { HighlightMatch } from "./HighlightMatch";

// Shared between list rows and the header in CardGrid so columns line up.
// Thumbnail + a flexible "website" column (domain as the primary line,
// description underneath) + category badge + actions (quick view + menu)
// — domain and folder no longer get their own columns.
export const LIST_GRID_COLS = "grid grid-cols-[64px_minmax(0,1fr)_140px_68px]";

// PRD §19–21: entire card opens the original site; thumbnail is the
// dominant visual element; secondary "..." menu offers Details/Copy/Remove.
// A quick-view icon sits beside (not inside) that menu, opening the site in
// an in-app overlay instead of a new tab.
export function Card({
  bookmark,
  variant = "grid",
  onRemove,
  onQuickView,
  highlightQuery,
}: {
  bookmark: BookmarkCardData;
  variant?: "grid" | "masonry" | "list";
  onRemove?: (id: string) => void;
  onQuickView?: (bookmark: BookmarkCardData) => void;
  highlightQuery?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const showImage = bookmark.thumbnailUrl && !imgFailed;

  if (variant === "list") {
    return (
      // Clicking anywhere in the row opens Quick View. The domain/title link
      // below is the one exception — it stops this from firing and instead
      // navigates directly (see its own onClick), so the two behaviors never
      // overlap on the same click.
      <div
        role="button"
        tabIndex={0}
        onClick={() => onQuickView?.(bookmark)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onQuickView?.(bookmark);
        }}
        className={`${LIST_GRID_COLS} group cursor-pointer items-center gap-4 border-b border-neutral-100 py-2.5 dark:border-neutral-800`}
      >
        <div className="flex h-12 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bookmark.thumbnailUrl!}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <ThumbnailPlaceholder domain={bookmark.domain} title={bookmark.title} />
          )}
        </div>
        <div className="min-w-0">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block w-fit max-w-full truncate text-sm font-semibold text-neutral-900 hover:underline dark:text-white"
          >
            <HighlightMatch text={bookmark.domain} query={highlightQuery} />
          </a>
          {/* A matched keyword deep in a long description would be clipped
              off-screen by a single-line truncate — search results get two
              lines instead so the highlight is actually visible. */}
          <p className={highlightQuery ? "line-clamp-2 text-xs text-neutral-500" : "truncate text-xs text-neutral-500"}>
            <HighlightMatch text={bookmark.description ?? bookmark.title} query={highlightQuery} />
          </p>
        </div>
        <div>{bookmark.category && <CategoryBadge category={bookmark.category} />}</div>
        <div className="flex items-center gap-0.5">
          <QuickViewButton onClick={() => onQuickView?.(bookmark)} />
          <CardMenu bookmark={bookmark} open={menuOpen} setOpen={setMenuOpen} onRemove={onRemove} inline />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-neutral-100 bg-white transition hover:shadow-lg dark:border-neutral-800 dark:bg-ink-900 ${
        variant === "masonry" ? "mb-4 break-inside-avoid" : ""
      }`}
    >
      <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="block">
        <div className={variant === "masonry" ? "relative w-full" : "relative aspect-[4/3] w-full"}>
          {bookmark.category && (
            <div className="absolute left-2 top-2 z-[1]">
              <CategoryBadge category={bookmark.category} overlay />
            </div>
          )}
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bookmark.thumbnailUrl!}
              alt=""
              loading="lazy"
              decoding="async"
              className={variant === "masonry" ? "w-full object-cover" : "h-full w-full object-cover"}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className={variant === "masonry" ? "aspect-[4/3] w-full" : "h-full w-full"}>
              <ThumbnailPlaceholder domain={bookmark.domain} title={bookmark.title} />
            </div>
          )}
        </div>
      </a>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
          <h3 className="truncate text-sm font-semibold leading-snug">
            <HighlightMatch text={bookmark.title} query={highlightQuery} />
          </h3>
        </a>
        <p className="truncate text-xs text-neutral-500">
          <HighlightMatch text={bookmark.domain} query={highlightQuery} />
        </p>
        {bookmark.description && (
          <p className="line-clamp-2 text-xs text-neutral-500">
            <HighlightMatch text={bookmark.description} query={highlightQuery} />
          </p>
        )}
        {bookmark.folderPath && (
          <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-neutral-400">
            {bookmark.folderPath}
          </p>
        )}
      </div>

      <div className="absolute right-2 top-2 flex items-center gap-1">
        <QuickViewButton onClick={() => onQuickView?.(bookmark)} corner />
        <CardMenu bookmark={bookmark} open={menuOpen} setOpen={setMenuOpen} onRemove={onRemove} />
      </div>
    </div>
  );
}

// PRD §48's "AI categorization" concept, implemented as a deterministic
// keyword lookup (see lib/categorize.ts) — a single small badge per card,
// not a wall of tags, to stay in line with the "low visual noise" direction.
// Each category gets its own color so badges are actually easy to scan.
function CategoryBadge({ category, overlay = false }: { category: string; overlay?: boolean }) {
  const colorClass = overlay ? categoryOverlayColorClass(category) : categoryColorClass(category);
  return (
    <span
      className={`${colorClass} shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        overlay ? "backdrop-blur-sm" : ""
      }`}
    >
      {category}
    </span>
  );
}

// Icon-only button (no text) placed beside — not inside — the "..." menu.
// Opens the QuickViewModal instead of navigating away.
function QuickViewButton({ onClick, corner = false }: { onClick: () => void; corner?: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label="Quick view"
      title="Quick view"
      className={
        corner
          ? "flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-neutral-600 opacity-0 shadow transition group-hover:opacity-100 dark:bg-neutral-800/90 dark:text-neutral-300"
          : "flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      }
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </button>
  );
}

function CardMenu({
  bookmark,
  open,
  setOpen,
  onRemove,
  inline = false,
}: {
  bookmark: BookmarkCardData;
  open: boolean;
  setOpen: (v: boolean) => void;
  onRemove?: (id: string) => void;
  inline?: boolean;
}) {
  // Positioning (corner overlay vs. inline table cell) is handled by the
  // parent wrapper now — this only controls the button's own visual style.
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className={
          inline
            ? "flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            : "flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-neutral-600 opacity-0 shadow transition group-hover:opacity-100 dark:bg-neutral-800/90 dark:text-neutral-300"
        }
        aria-label="More actions"
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          onClick={(e) => e.stopPropagation()}
        >
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Open
          </a>
          <button
            className="block w-full px-3 py-1.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
            onClick={() => {
              navigator.clipboard.writeText(bookmark.url);
              setOpen(false);
            }}
          >
            Copy URL
          </button>
          <Link
            href={`/bookmark/${bookmark.id}`}
            className="block px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            View details
          </Link>
          {bookmark.folderId && (
            <Link
              href={`/folder/${bookmark.folderId}`}
              className="block px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Open folder
            </Link>
          )}
          {onRemove && (
            <button
              className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => {
                onRemove(bookmark.id);
                setOpen(false);
              }}
            >
              Remove from Organizer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
