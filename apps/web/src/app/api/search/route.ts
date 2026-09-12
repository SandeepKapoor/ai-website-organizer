import { NextRequest, NextResponse } from "next/server";
import { queryBookmarks } from "@/lib/queryBookmarks";

// GET /api/search?q=stripe&limit=&offset=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ bookmarks: [], total: 0, hasMore: false });

  const result = await queryBookmarks({
    q,
    sort: "recently_added",
    limit: Number(searchParams.get("limit")) || undefined,
    offset: Number(searchParams.get("offset")) || undefined,
  });
  return NextResponse.json(result);
}
