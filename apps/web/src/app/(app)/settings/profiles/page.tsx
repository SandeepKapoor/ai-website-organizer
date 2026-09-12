"use client";

import { useEffect, useState } from "react";

interface Profile {
  id: string;
  profileName: string;
  connectionStatus: string;
  lastSyncedAt: string | null;
  bookmarkCount: number;
}

export default function ProfilesSettingsPage() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/profiles/connect", { cache: "no-store" });
    const data = await res.json();
    setProfiles(data.profiles);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Connected Chrome Profiles</h1>
        <p className="text-sm text-neutral-500">
          Each Chrome profile is a separate bookmark source (PRD §10).
        </p>
      </div>

      {profiles === null && <p className="text-sm text-neutral-400">Loading...</p>}

      {profiles?.length === 0 && (
        <p className="text-sm text-neutral-400">
          No Chrome profile connected yet. Install the extension and connect a profile to begin.
        </p>
      )}

      <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
        {profiles?.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{p.profileName}</p>
                <p className="text-xs text-neutral-500">
                  {p.bookmarkCount} bookmarks · <StatusBadge status={p.connectionStatus} />
                  {p.lastSyncedAt &&
                    ` · Last synced ${new Date(p.lastSyncedAt).toLocaleTimeString()}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setHistoryOpenFor(historyOpenFor === p.id ? null : p.id)}
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs dark:border-neutral-700"
                >
                  {historyOpenFor === p.id ? "Hide history" : "Sync history"}
                </button>
              </div>
            </div>
            {historyOpenFor === p.id && <SyncHistory profileId={p.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    connected: "Connected",
    syncing: "Syncing",
    synced: "✓ Synced",
    connection_error: "Connection error",
    disconnected: "Disconnected",
  };
  return <span>{labels[status] ?? status}</span>;
}

interface SyncLogChange {
  action: string;
  title: string;
  url: string;
}

interface SyncLogEntry {
  id: string;
  createdAt: string;
  source: string;
  addedCount: number;
  removedCount: number;
  duplicateSuppressedCount: number;
  unsuppressedCount: number;
  totalChanges: number;
  restoredAt: string | null;
  changes: SyncLogChange[];
}

const ACTION_LABELS: Record<string, string> = {
  created: "Added",
  removed: "Removed",
  suppressed_duplicate: "Hidden as duplicate",
  unsuppressed: "Un-hidden",
};

function summarize(log: SyncLogEntry): string {
  const parts: string[] = [];
  if (log.addedCount) parts.push(`${log.addedCount} added`);
  if (log.removedCount) parts.push(`${log.removedCount} removed`);
  if (log.duplicateSuppressedCount) parts.push(`${log.duplicateSuppressedCount} hidden as duplicates`);
  if (log.unsuppressedCount) parts.push(`${log.unsuppressedCount} un-hidden`);
  return parts.join(" · ") || "No changes";
}

// Every sync that actually changed something gets logged here (PRD-adjacent
// feature: a routine no-op resync doesn't clutter this list). Each entry can
// be individually undone — a "created" bookmark gets deleted, everything
// else reverts to whatever it was right before that sync.
function SyncHistory({ profileId }: { profileId: string }) {
  const [logs, setLogs] = useState<SyncLogEntry[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/profiles/${profileId}/sync-logs`, { cache: "no-store" });
    const data = await res.json();
    setLogs(data.logs);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function restore(logId: string) {
    if (!confirm("Undo everything this sync changed?")) return;
    setRestoringId(logId);
    await fetch(`/api/sync-logs/${logId}/restore`, { method: "POST" });
    await load();
    setRestoringId(null);
  }

  if (logs === null) {
    return <p className="text-xs text-neutral-400">Loading history...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-xs text-neutral-400">No sync changes recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 p-3 dark:border-neutral-800">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex flex-col gap-1.5 border-b border-neutral-100 pb-2 text-xs last:border-0 last:pb-0 dark:border-neutral-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">
                {new Date(log.createdAt).toLocaleString()}
                <span className="ml-1.5 font-normal text-neutral-400">
                  ({log.source === "full_import" ? "Full re-sync" : "Live sync"})
                </span>
              </p>
              <p className="text-neutral-500">{summarize(log)}</p>
            </div>
            {log.restoredAt ? (
              <span className="shrink-0 text-neutral-400">Restored</span>
            ) : (
              <button
                onClick={() => restore(log.id)}
                disabled={restoringId === log.id}
                className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 disabled:opacity-50 dark:border-neutral-700"
              >
                {restoringId === log.id ? "Restoring..." : "Restore"}
              </button>
            )}
          </div>
          {log.changes.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-neutral-400">
              {log.changes.map((c, i) => (
                <li key={i} className="truncate">
                  {ACTION_LABELS[c.action] ?? c.action} — {c.title}
                </li>
              ))}
              {log.totalChanges > log.changes.length && (
                <li>+{log.totalChanges - log.changes.length} more</li>
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
