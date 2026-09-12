"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Account {
  id: string;
  email: string;
  name: string | null;
}

export default function SettingsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  // Dark is the product default (applied by the blocking script in the root
  // layout before this component even mounts) — this just mirrors that
  // choice into the UI, only overriding it once a preference is saved.
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((d) => setAccount(d.user));
    const saved = (localStorage.getItem("theme") as typeof theme) ?? "dark";
    setTheme(saved);
  }, []);

  function applyTheme(next: typeof theme) {
    setTheme(next);
    localStorage.setItem("theme", next);
    const root = document.documentElement;
    const isDark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);
  }

  async function deleteAllBookmarks() {
    if (!confirm("Delete all imported bookmarks? Your actual Chrome bookmarks are unaffected.")) return;
    const profiles = await fetch("/api/profiles/connect").then((r) => r.json());
    await Promise.all(
      profiles.profiles.map((p: { id: string }) =>
        fetch(`/api/profiles/${p.id}`, { method: "DELETE" }),
      ),
    );
    alert("Imported bookmark data deleted.");
  }

  async function deleteAccount() {
    if (!confirm("Delete your account and all data? This cannot be undone.")) return;
    await fetch("/api/account", { method: "DELETE" });
    alert("Account deleted.");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-10">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Account
        </h2>
        <p className="text-sm">{account?.name}</p>
        <p className="text-sm text-neutral-500">{account?.email}</p>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Connected Chrome Profiles
        </h2>
        <Link href="/settings/profiles" className="text-sm underline">
          Manage connected profiles →
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Appearance
        </h2>
        <div className="inline-flex rounded-full border border-neutral-200 p-0.5 text-xs dark:border-neutral-700">
          {(["light", "dark", "system"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => applyTheme(opt)}
              className={`rounded-full px-3 py-1.5 capitalize transition ${
                theme === opt
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-500"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Data</h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={deleteAllBookmarks}
            className="w-fit rounded-full border border-neutral-200 px-4 py-2 text-sm dark:border-neutral-700"
          >
            Delete imported bookmarks
          </button>
          <button
            onClick={deleteAccount}
            className="w-fit rounded-full border border-red-200 px-4 py-2 text-sm text-red-600 dark:border-red-900"
          >
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
