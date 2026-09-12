// AI Website Organizer — background service worker (Manifest V3).
// Handles: connecting a Chrome profile, the initial full-tree import
// (PRD §11), and incremental sync of onCreated/onChanged/onMoved/onRemoved
// events (PRD §12). Written in plain JS so it can be loaded unpacked with
// no build step.

const DEFAULT_API_BASE = "http://localhost:3000/api";
const FLUSH_DEBOUNCE_MS = 800;

let flushTimer = null;

async function getApiBase() {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  return apiBase || DEFAULT_API_BASE;
}

async function getProfileId() {
  const { profileId } = await chrome.storage.local.get("profileId");
  return profileId || null;
}

async function getConnectionInfo() {
  const { profileId, profileName } = await chrome.storage.local.get(["profileId", "profileName"]);
  return { profileId: profileId || null, profileName: profileName || null };
}

// --- Tree traversal -------------------------------------------------------

function traverseTree(rootNodes) {
  const folders = [];
  const bookmarks = [];

  function visit(node, parentPath) {
    const isFolder = node.children !== undefined;
    if (isFolder) {
      const isSyntheticRoot = node.id === "0";
      const path = isSyntheticRoot
        ? ""
        : parentPath
          ? `${parentPath} / ${node.title}`
          : node.title;

      if (!isSyntheticRoot) {
        folders.push({
          chromeFolderId: node.id,
          parentChromeFolderId: node.parentId === "0" ? null : node.parentId,
          name: node.title || "Untitled",
          path,
          index: node.index ?? 0,
        });
      }
      for (const child of node.children) visit(child, path);
    } else {
      bookmarks.push({
        chromeBookmarkId: node.id,
        title: node.title || node.url,
        url: node.url,
        parentChromeFolderId: node.parentId === "0" ? null : node.parentId,
        path: parentPath,
        index: node.index ?? 0,
        dateAdded: node.dateAdded ?? Date.now(),
      });
    }
  }

  for (const root of rootNodes) visit(root, "");
  return { folders, bookmarks };
}

// --- Connect + initial import ---------------------------------------------

async function connectProfile(profileName) {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/profiles/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileName }),
  });
  if (!res.ok) throw new Error(`Failed to connect profile (${res.status})`);
  const data = await res.json();
  await chrome.storage.local.set({ profileId: data.profileId, profileName: data.profileName });
  await performInitialImport();
  return data;
}

async function performInitialImport() {
  const profileId = await getProfileId();
  if (!profileId) return;

  const tree = await chrome.bookmarks.getTree();
  const { folders, bookmarks } = traverseTree(tree);
  const apiBase = await getApiBase();

  const res = await fetch(`${apiBase}/bookmarks/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, folders, bookmarks }),
  });
  if (!res.ok) throw new Error(`Import failed (${res.status})`);
  return res.json();
}

// --- Incremental sync -------------------------------------------------------

async function queueEvent(event) {
  const { pendingEvents } = await chrome.storage.local.get("pendingEvents");
  const next = [...(pendingEvents || []), event];
  await chrome.storage.local.set({ pendingEvents: next });

  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushQueue, FLUSH_DEBOUNCE_MS);
}

async function flushQueue() {
  flushTimer = null;
  const profileId = await getProfileId();
  const { pendingEvents } = await chrome.storage.local.get("pendingEvents");
  if (!profileId || !pendingEvents || pendingEvents.length === 0) return;

  await chrome.storage.local.set({ pendingEvents: [] });
  const apiBase = await getApiBase();

  try {
    await fetch(`${apiBase}/bookmarks/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, events: pendingEvents }),
    });
  } catch (err) {
    // Offline or backend down — requeue for the next successful flush.
    const { pendingEvents: latest } = await chrome.storage.local.get("pendingEvents");
    await chrome.storage.local.set({ pendingEvents: [...pendingEvents, ...(latest || [])] });
  }
}

function isFolderNode(node) {
  return node.url === undefined;
}

chrome.bookmarks.onCreated.addListener((id, node) => {
  queueEvent(
    isFolderNode(node)
      ? {
          type: "folder_created",
          chromeFolderId: id,
          parentChromeFolderId: node.parentId === "0" ? null : node.parentId,
          name: node.title || "Untitled",
          path: node.title || "Untitled",
          index: node.index ?? 0,
        }
      : {
          type: "bookmark_created",
          chromeBookmarkId: id,
          title: node.title || node.url,
          url: node.url,
          parentChromeFolderId: node.parentId === "0" ? null : node.parentId,
          index: node.index ?? 0,
          dateAdded: node.dateAdded ?? Date.now(),
        },
  );
});

chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  const [node] = await chrome.bookmarks.get(id).catch(() => []);
  if (!node) return;

  queueEvent(
    isFolderNode(node)
      ? { type: "folder_changed", chromeFolderId: id, name: changeInfo.title }
      : { type: "bookmark_changed", chromeBookmarkId: id, title: changeInfo.title, url: changeInfo.url },
  );
});

chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
  const [node] = await chrome.bookmarks.get(id).catch(() => []);
  if (!node) return;

  const parentChromeFolderId = moveInfo.parentId === "0" ? null : moveInfo.parentId;
  queueEvent(
    isFolderNode(node)
      ? { type: "folder_moved", chromeFolderId: id, parentChromeFolderId, index: moveInfo.index }
      : { type: "bookmark_moved", chromeBookmarkId: id, parentChromeFolderId, index: moveInfo.index },
  );
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  const node = removeInfo.node;
  queueEvent(
    node && isFolderNode(node)
      ? { type: "folder_removed", chromeFolderId: id }
      : { type: "bookmark_removed", chromeBookmarkId: id },
  );
});

// --- Messaging with the popup ------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "GET_STATUS") {
        sendResponse({ ok: true, ...(await getConnectionInfo()) });
      } else if (message.type === "CONNECT_PROFILE") {
        const data = await connectProfile(message.profileName);
        sendResponse({ ok: true, ...data });
      } else if (message.type === "REIMPORT") {
        await performInitialImport();
        sendResponse({ ok: true });
      } else if (message.type === "DISCONNECT") {
        await chrome.storage.local.remove(["profileId", "profileName"]);
        sendResponse({ ok: true });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true; // keep the message channel open for the async response
});
