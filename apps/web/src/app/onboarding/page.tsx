"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  profileName: string;
  connectionStatus: string;
  bookmarkCount: number;
}

// PRD §9, §32: local MVP skips real Google sign-in (a local account is
// auto-created) and starts at "install & connect the extension".
export default function OnboardingPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch("/api/profiles/connect", { cache: "no-store" });
      const data = await res.json();
      setProfiles(data.profiles ?? []);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const connected = profiles.find((p) => p.bookmarkCount > 0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Website Organizer</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Connect your Chrome bookmarks to build your visual library.
        </p>
      </div>

      {!connected ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-200 px-8 py-10 dark:border-neutral-800">
          <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
            Install the Chrome extension, then open its popup and click{" "}
            <strong>Connect this profile</strong>. This page updates automatically once it's
            connected.
          </p>
          <code className="rounded bg-neutral-100 px-3 py-1.5 text-xs dark:bg-neutral-900">
            apps/extension — load unpacked in chrome://extensions
          </code>
          <p className="text-xs text-neutral-400">Waiting for a Chrome profile to connect...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-medium">Your library is ready.</p>
          <p className="text-sm text-neutral-500">
            {connected.bookmarkCount} websites imported from “{connected.profileName}”.
          </p>
          <button
            onClick={() => router.push("/")}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Explore Library
          </button>
        </div>
      )}
    </div>
  );
}
