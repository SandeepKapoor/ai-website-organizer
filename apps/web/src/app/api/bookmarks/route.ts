import { NextRequest, NextResponse } from "next/server";
import { queryBookmarks } from "@/lib/queryBookmarks";

// GET /api/bookmarks?folderId=&q=&sort=&domain=&limit=&offset=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const result = await queryBookmarks({
    folderId: searchParams.get("folderId"),
    includeDescendants: searchParams.get("includeDescendants") !== "false",
    q: searchParams.get("q")?.trim(),
    domain: searchParams.get("domain"),
    sort: searchParams.get("sort") ?? "recently_added",
    limit: Number(searchParams.get("limit")) || undefined,
    offset: Number(searchParams.get("offset")) || undefined,
  });

  return NextResponse.json(result);
}
