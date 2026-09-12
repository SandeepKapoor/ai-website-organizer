"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FolderNode } from "@/lib/types";
import { getFolderEmoji } from "@/lib/folderEmoji";

function findAncestorIds(folders: FolderNode[], targetId: string): string[] {
  for (const folder of folders) {
    if (folder.id === targetId) return [folder.id];
    const childPath = findAncestorIds(folder.children, targetId);
    if (childPath.length > 0) return [folder.id, ...childPath];
  }
  return [];
}

function findNode(folders: FolderNode[], targetId: string): FolderNode | null {
  for (const folder of folders) {
    if (folder.id === targetId) return folder;
    const found = findNode(folder.children, targetId);
    if (found) return found;
  }
  return null;
}

function collectSubtreeIds(node: FolderNode): string[] {
  return [node.id, ...node.children.flatMap(collectSubtreeIds)];
}

// A plain outline folder icon on every row (every depth), not just the
// top-level emoji — this is what actually reads as a folder hierarchy at a
// glance, the way Chrome's own bookmark manager does it.
function FolderIcon({ active, colorClass }: { active: boolean; colorClass?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 shrink-0 ${active ? "text-white" : (colorClass ?? "text-neutral-500")}`}
    >
      <path
        d="M2.5 5.5a1 1 0 0 1 1-1H8l1.5 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Each top-level ("main") folder gets its own color, deterministically
// picked from its id — a main folder and its direct children (the "first
// nested layer") share that color; anything nested deeper than that stays
// plain/neutral. Only used at depth 0/1 — see FolderTreeItem below.
const FOLDER_COLOR_PALETTE = [
  "text-indigo-300",
  "text-sky-300",
  "text-emerald-300",
  "text-amber-300",
  "text-rose-300",
  "text-violet-300",
  "text-orange-300",
  "text-teal-300",
  "text-fuchsia-300",
  "text-lime-300",
  "text-cyan-300",
  "text-red-300",
  "text-blue-300",
  "text-yellow-300",
  "text-purple-300",
  "text-pink-300",
];

function pickFolderColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FOLDER_COLOR_PALETTE[hash % FOLDER_COLOR_PALETTE.length];
}

export function Sidebar({ folders }: { folders: FolderNode[] }) {
  const pathname = usePathname();
  const activeFolderId = pathname.startsWith("/folder/") ? pathname.split("/")[2] : null;

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (!activeFolderId) return new Set();
    // Opening a folder (including landing on it directly via navigation)
    // cascades open its entire subtree, not just the path down to it —
    // otherwise you have to click into every nested level one at a time.
    const activeNode = findNode(folders, activeFolderId);
    const ids = findAncestorIds(folders, activeFolderId);
    if (activeNode) ids.push(...collectSubtreeIds(activeNode));
    return new Set(ids);
  });

  // The sidebar stays mounted across client-side navigations (the layout
  // isn't remounted per route), so navigating to a folder via its link —
  // not just clicking its chevron — needs its own effect to cascade-open
  // that folder's subtree; the useState initializer above only covers the
  // very first mount.
  useEffect(() => {
    if (!activeFolderId) return;
    const activeNode = findNode(folders, activeFolderId);
    if (!activeNode) return;
    const ids = [...findAncestorIds(folders, activeFolderId), ...collectSubtreeIds(activeNode)];
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, [activeFolderId, folders]);

  function toggle(folder: FolderNode) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folder.id)) {
        next.delete(folder.id);
      } else {
        for (const id of collectSubtreeIds(folder)) next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    const all = new Set<string>();
    const collect = (nodes: FolderNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) all.add(n.id);
        collect(n.children);
      }
    };
    collect(folders);
    setExpanded(all);
  }

  return (
    // Fixed black theme (not tied to the light/dark toggle) with a light
    // border so the boundary with the main content is always clearly
    // visible, and its own independent scroll region (h-full + overflow-y
    // inside a fixed-height parent) so scrolling the sidebar never moves
    // the main content and vice versa.
    <aside className="hidden h-full w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-neutral-300 bg-black px-4 py-6 md:flex">
      <nav className="flex flex-col gap-0.5 text-sm">
        <SidebarLink href="/" active={pathname === "/"}>
          All Bookmarks
        </SidebarLink>
      </nav>

      <div>
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white">
            Chrome Folders
          </p>
          <div className="flex gap-2 text-[11px]">
            <button onClick={expandAll} className="text-neutral-400 hover:text-white">
              Expand all
            </button>
            <button onClick={() => setExpanded(new Set())} className="text-neutral-400 hover:text-white">
              Collapse all
            </button>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 text-sm">
          {folders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              folder={folder}
              depth={0}
              pathname={pathname}
              expanded={expanded}
              onToggle={toggle}
            />
          ))}
          {folders.length === 0 && (
            <p className="px-2 text-xs text-neutral-400">No folders yet.</p>
          )}
        </nav>
      </div>

      <nav className="mt-auto flex flex-col gap-0.5 text-sm">
        <SidebarLink href="/settings/profiles" active={pathname === "/settings/profiles"}>
          Profiles
        </SidebarLink>
        <SidebarLink href="/settings" active={pathname === "/settings"}>
          Settings
        </SidebarLink>
      </nav>
    </aside>
  );
}

// Visual hierarchy across the three folder levels: main category (depth 0,
// bold + has the emoji), subcategory (depth 1, medium weight), tertiary and
// deeper (lighter weight, most muted, and never colored).
function depthTextClass(depth: number, active: boolean, colorClass?: string): string {
  if (active) return "text-sm font-semibold text-white";
  if (depth === 0) return `text-sm font-semibold ${colorClass ?? "text-white"}`;
  if (depth === 1) return `text-sm font-medium ${colorClass ?? "text-neutral-300"}`;
  return "text-xs font-normal text-neutral-400";
}

function FolderTreeItem({
  folder,
  depth,
  pathname,
  expanded,
  onToggle,
  colorClass,
}: {
  folder: FolderNode;
  depth: number;
  pathname: string;
  expanded: Set<string>;
  onToggle: (folder: FolderNode) => void;
  // Only ever set for depth 0 (assigned here) and depth 1 (inherited from
  // its depth-0 parent, one level only) — depth 2+ never receives one.
  colorClass?: string;
}) {
  const active = pathname === `/folder/${folder.id}`;
  const hasChildren = folder.children.length > 0;
  const isOpen = expanded.has(folder.id);
  const ownColorClass = depth === 0 ? pickFolderColor(folder.id) : colorClass;
  // "Bigger categories" are the top-level sidebar entries. Chrome's root
  // containers (Bookmarks Bar / Other Bookmarks) are flattened away in
  // lib/folderTree.ts, so depth 0 here is what used to be depth 1 (their
  // direct children).
  const emoji = depth === 0 ? getFolderEmoji(folder.name) : null;

  return (
    <div>
      <div
        // Active gets the full rounded "pill" treatment (like Chrome's own
        // bookmark manager) so the current folder is unmistakable; hover on
        // an inactive row stays a plain subtle rectangle.
        className={`group flex items-center pr-2 transition ${
          active ? "rounded-full bg-indigo-500" : "rounded-md hover:bg-white/5"
        }`}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggle(folder);
          }}
          className={`flex h-6 w-5 shrink-0 items-center justify-center text-xs ${
            active ? "text-white/80" : "text-neutral-400"
          } ${hasChildren ? "opacity-70 hover:opacity-100" : "opacity-0"}`}
          aria-label={isOpen ? "Collapse folder" : "Expand folder"}
          tabIndex={hasChildren ? 0 : -1}
        >
          {hasChildren ? (isOpen ? "▾" : "▸") : ""}
        </button>
        <Link
          href={`/folder/${folder.id}`}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2"
        >
          <span className={`flex min-w-0 items-center gap-2 truncate ${depthTextClass(depth, active, ownColorClass)}`}>
            <FolderIcon active={active} colorClass={ownColorClass} />
            {emoji && <span aria-hidden>{emoji}</span>}
            <span className="truncate">{folder.name}</span>
          </span>
          {folder.bookmarkCount > 0 && (
            <span className={`text-xs ${active ? "text-white/70" : "text-neutral-500"}`}>
              {folder.bookmarkCount}
            </span>
          )}
        </Link>
      </div>
      {hasChildren && isOpen && (
        <div className="relative">
          <span
            aria-hidden
            className="absolute bottom-0 top-0 w-px bg-white/15"
            style={{ left: `${depth * 16 + 13}px` }}
          />
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              pathname={pathname}
              expanded={expanded}
              onToggle={onToggle}
              // Only depth 0 passes its color down to depth 1 — depth 1
              // never passes it on further, so depth 2+ stays uncolored.
              colorClass={depth === 0 ? ownColorClass : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-2 font-medium text-white transition ${
        active ? "rounded-full bg-indigo-500" : "rounded-md hover:bg-white/5"
      }`}
    >
      {children}
    </Link>
  );
}
