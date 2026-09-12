import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBookmark } from "@/lib/serialize";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const bookmark = await prisma.bookmark.findUnique({
    where: { id: params.id },
    include: { website: true, folder: true },
  });
  if (!bookmark || bookmark.isDeleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ bookmark: serializeBookmark(bookmark) });
}

// PATCH lets the UI's "Remove from Organizer" action soft-delete a bookmark
// locally without touching the user's actual Chrome bookmark (PRD §21, §41).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const bookmark = await prisma.bookmark.update({
    where: { id: params.id },
    data: {
      ...(typeof body.isDeleted === "boolean" ? { isDeleted: body.isDeleted } : {}),
    },
    include: { website: true, folder: true },
  });
  return NextResponse.json({ bookmark: serializeBookmark(bookmark) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.bookmark.update({ where: { id: params.id }, data: { isDeleted: true } });
  return NextResponse.json({ ok: true });
}
