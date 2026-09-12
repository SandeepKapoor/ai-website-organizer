import { NextResponse } from "next/server";
import { getFolderTree } from "@/lib/folderTree";

// GET /api/folders — returns the folder tree across all connected profiles,
// mirroring Chrome's hierarchy for the sidebar (PRD §25). Chrome's own
// permanent root containers (Bookmarks Bar / Other Bookmarks / Mobile
// Bookmarks) are flattened away — see lib/folderTree.ts.
export async function GET() {
  const folders = await getFolderTree();
  return NextResponse.json({ folders });
}
