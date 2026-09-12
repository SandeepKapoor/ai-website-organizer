"use client";

import { useEffect } from "react";
import type { BookmarkCardData } from "@/lib/types";

// Full-screen overlay that loads the actual site in an iframe so it can be
// scrolled/inspected without leaving the library. Closes via backdrop
// click, Escape, or the explicit close button — all three requested
// explicitly, not just one.
export function QuickViewModal({
  bookmark,
  onClose,
}: {
  bookmark: BookmarkCardData | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!bookmark) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [bookmark, onClose]);

  if (!bookmark) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <div className="flex min-w-0 items-center gap-2">
            {bookmark.favicon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bookmark.favicon} alt="" className="h-4 w-4 shrink-0" />
            )}
            <p className="truncate text-sm font-medium">{bookmark.title}</p>
            <span className="shrink-0 text-xs text-neutral-400">{bookmark.domain}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Open in new tab
            </a>
            <button
              onClick={onClose}
              aria-label="Close quick view"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <iframe
          src={bookmark.url}
          title={bookmark.title}
          className="flex-1 bg-white"
          // Some sites block being framed (X-Frame-Options/CSP) — the browser
          // enforces that itself and there's no reliable way to detect it
          // client-side, which is why "Open in new tab" above is always there.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
