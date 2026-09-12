"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Header() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  // Keeps the search box in sync with the actual URL — landing on
  // /search?q=... directly (a bookmark, back/forward nav) previously left
  // this input empty even though a search was active. Reads
  // window.location.search in an effect rather than useSearchParams() so
  // this doesn't force the whole app shell into dynamic rendering.
  useEffect(() => {
    if (pathname === "/search") {
      setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    } else {
      setQuery("");
    }
  }, [pathname]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/");
    }
  }

  function clear() {
    setQuery("");
    router.push("/");
  }

  return (
    <header className="flex items-center gap-6 border-b border-neutral-100 px-6 py-4 dark:border-neutral-800">
      <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
        AI Website Organizer
      </Link>
      <form onSubmit={submit} className="flex-1">
        <div className="relative w-full max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your websites..."
            className="w-full rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 pr-9 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900"
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </form>
    </header>
  );
}
