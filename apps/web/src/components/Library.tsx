"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BookmarkCardData } from "@/lib/types";
import { CardGrid } from "./CardGrid";
import { ViewToggle, type ViewMode } from "./ViewToggle";
import { SortSelect } from "./SortSelect";
import { QuickViewModal } from "./QuickViewModal";

interface LibraryProps {
  folderId?: string;
  query?: string;
  title: string;
  breadcrumb?: React.ReactNode;
}

interface EnrichmentStatus {
  pending: number;
  processing: number;
  complete: number;
  failed: number;
}

const PAGE_SIZE = 60;

// All Bookmarks defaults to alphabetical (easiest to scan a huge merged
// list); inside a folder it defaults to "original order" — the manual
// arrangement from Chrome itself — since that's the order you put real
// thought into, though alphabetical stays one dropdown click away there too.
function defaultSortFor(folderId?: string, query?: string): string {
  if (query) return "recently_added";
  if (folderId) return "folder_order";
  return "alphabetical";
}

export function Library({ folderId, query, title, breadcrumb }: LibraryProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkCardData[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [sort, setSort] = useState(() => defaultSortFor(folderId, query));
  const [enrichment, setEnrichment] = useState<EnrichmentStatus | null>(null);
  const [quickViewBookmark, setQuickViewBookmark] = useState<BookmarkCardData | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Guards against out-of-order responses: requests fire independently
  // (page loads, poll ticks) without waiting for each other, so a slower
  // earlier request can resolve after a faster later one.
  const loadSeq = useRef(0);
  const enrichSeq = useRef(0);
  // Rendering every matching bookmark at once (no cap) is what made the app
  // feel slow once real screenshots replaced placeholders — thousands of
  // images in one DOM tree. Everything is paged now; this ref tracks how
  // many are currently loaded so the enrichment poller can refresh exactly
  // that many without resetting scroll position or the loaded-count.
  const loadedCountRef = useRef(0);

  const endpointBase = query ? "/api/search" : "/api/bookmarks";

  const fetchPage = useCallback(
    async (limit: number, offset: number) => {
      const params = new URLSearchParams({ sort, limit: String(limit), offset: String(offset) });
      if (folderId) params.set("folderId", folderId);
      if (query) params.set("q", query);
      const res = await fetch(`${endpointBase}?${params.toString()}`, { cache: "no-store" });
      return res.json() as Promise<{ bookmarks: BookmarkCardData[]; total: number; hasMore: boolean }>;
    },
    [endpointBase, folderId, query, sort],
  );

  // Resets to the first page — used when the folder/search/sort changes.
  const reset = useCallback(async () => {
    const seq = ++loadSeq.current;
    const data = await fetchPage(PAGE_SIZE, 0);
    if (seq !== loadSeq.current) return;
    setBookmarks(data.bookmarks);
    setTotal(data.total);
    setHasMore(data.hasMore);
    loadedCountRef.current = data.bookmarks.length;
  }, [fetchPage]);

  // Re-fetches exactly what's already loaded, in place — used by the
  // enrichment poller so in-progress thumbnails/descriptions update without
  // disturbing scroll position or collapsing back to one page.
  const refreshLoaded = useCallback(async () => {
    const seq = ++loadSeq.current;
    const data = await fetchPage(loadedCountRef.current || PAGE_SIZE, 0);
    if (seq !== loadSeq.current) return;
    setBookmarks(data.bookmarks);
    setTotal(data.total);
    setHasMore(data.hasMore);
    loadedCountRef.current = data.bookmarks.length;
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    const data = await fetchPage(PAGE_SIZE, loadedCountRef.current);
    setBookmarks((prev) => [...(prev ?? []), ...data.bookmarks]);
    setTotal(data.total);
    setHasMore(data.hasMore);
    loadedCountRef.current += data.bookmarks.length;
    setLoadingMore(false);
  }, [fetchPage]);

  // Navigating between "All Bookmarks" and a folder (or between folders)
  // resets the sort back to that view's default — alphabetical at the root,
  // original Chrome order inside a folder. A manual pick from the dropdown
  // still sticks until the next navigation.
  useEffect(() => {
    setSort(defaultSortFor(folderId, query));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId, query]);

  useEffect(() => {
    setBookmarks(null);
    reset();
  }, [reset]);

  // Infinite scroll: load the next page once the sentinel at the bottom
  // enters the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  // PRD §33–34: enrichment continues after cards are already visible, so
  // poll briefly to pick up thumbnails/descriptions as they complete.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const seq = ++enrichSeq.current;
      const status: EnrichmentStatus = await fetch("/api/metadata/enrich", { cache: "no-store" }).then(
        (r) => r.json(),
      );
      if (seq !== enrichSeq.current) return;
      setEnrichment(status);
      if (status.pending > 0 || status.processing > 0) {
        refreshLoaded();
      } else {
        refreshLoaded();
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshLoaded]);

  async function handleRemove(id: string) {
    setBookmarks((prev) => prev?.filter((b) => b.id !== id) ?? prev);
    loadedCountRef.current = Math.max(0, loadedCountRef.current - 1);
    setTotal((t) => Math.max(0, t - 1));
    await fetch(`/api/bookmarks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: true }),
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-6">
      {breadcrumb}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {title}
          {total > 0 && <span className="ml-2 text-sm font-normal text-neutral-400">{total.toLocaleString()}</span>}
        </h1>
        <div className="flex items-center gap-2">
          <SortSelect value={sort} onChange={setSort} />
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      <EnrichmentBanner status={enrichment} />

      {bookmarks === null && <p className="text-sm text-neutral-400">Loading your library...</p>}

      {bookmarks !== null && bookmarks.length === 0 && (
        <EmptyState isSearch={Boolean(query)} />
      )}

      {bookmarks !== null && bookmarks.length > 0 && (
        <>
          <CardGrid
            bookmarks={bookmarks}
            view={view}
            onRemove={handleRemove}
            onQuickView={setQuickViewBookmark}
            highlightQuery={query}
          />
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <p className="py-4 text-center text-xs text-neutral-400">Loading more...</p>
          )}
        </>
      )}

      <QuickViewModal bookmark={quickViewBookmark} onClose={() => setQuickViewBookmark(null)} />
    </div>
  );
}

function EnrichmentBanner({ status }: { status: EnrichmentStatus | null }) {
  if (!status) return null;
  const inFlight = status.pending + status.processing;
  // A handful of stragglers (slow/retried sites) isn't worth a persistent
  // banner — only show this during an actual bulk import/enrichment run.
  if (inFlight <= 10) return null;

  const total = status.pending + status.processing + status.complete + status.failed;
  const done = status.complete + status.failed;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${pct}%` }} />
      </div>
      <span>
        Fetching thumbnails and descriptions — {done.toLocaleString()} of {total.toLocaleString()} done.
        Cards update automatically as they finish.
      </span>
    </div>
  );
}

function EmptyState({ isSearch }: { isSearch: boolean }) {
  if (isSearch) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-lg font-medium">No websites found.</p>
        <p className="text-sm text-neutral-400">Try another search.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-lg font-medium">Your library is empty.</p>
      <p className="text-sm text-neutral-400">Connect Chrome to import your bookmarks.</p>
      <a
        href="/onboarding"
        className="mt-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Connect Chrome
      </a>
    </div>
  );
}
