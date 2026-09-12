import { prisma } from "./db";
import type { FolderNode } from "./types";

function subtreeTotal(node: FolderNode): number {
  return node.bookmarkCount + node.children.reduce((sum, c) => sum + subtreeTotal(c), 0);
}

/**
 * Builds the folder tree and flattens away Chrome's permanent root
 * containers (Bookmarks Bar / Other Bookmarks / Mobile Bookmarks) — their
 * children become the top-level sidebar entries directly, and an empty
 * container (e.g. an unused "Other Bookmarks") is dropped entirely instead
 * of showing as a dead-end node someone has to expand into.
 */
export async function getFolderTree(): Promise<FolderNode[]> {
  const [folders, counts] = await Promise.all([
    prisma.bookmarkFolder.findMany({ orderBy: { position: "asc" } }),
    prisma.bookmark.groupBy({
      by: ["folderId"],
      where: { isDeleted: false },
      _count: { _all: true },
    }),
  ]);

  const countByFolderId = new Map(counts.map((c) => [c.folderId, c._count._all]));
  const nodeById = new Map<string, FolderNode>();
  for (const f of folders) {
    nodeById.set(f.id, {
      id: f.id,
      name: f.name,
      path: f.path,
      parentFolderId: f.parentFolderId,
      children: [],
      bookmarkCount: countByFolderId.get(f.id) ?? 0,
    });
  }

  const roots: FolderNode[] = [];
  for (const f of folders) {
    const node = nodeById.get(f.id)!;
    if (f.parentFolderId && nodeById.has(f.parentFolderId)) {
      nodeById.get(f.parentFolderId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots.filter((root) => subtreeTotal(root) > 0).flatMap((root) => root.children);
}
