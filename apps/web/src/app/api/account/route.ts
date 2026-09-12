import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateLocalUser } from "@/lib/currentUser";

export async function GET() {
  const user = await getOrCreateLocalUser();
  return NextResponse.json({ user });
}

// DELETE /api/account — deletes the local user and everything cascading
// from it (profiles, folders, bookmarks). PRD §41.
export async function DELETE() {
  const user = await getOrCreateLocalUser();
  await prisma.user.delete({ where: { id: user.id } });
  return NextResponse.json({ ok: true });
}
