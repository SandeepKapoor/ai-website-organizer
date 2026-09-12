import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PATCH /api/profiles/:id — disconnect stops future sync but keeps
// previously imported data (PRD §41).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const profile = await prisma.chromeProfile.update({
    where: { id: params.id },
    data: {
      ...(body.connectionStatus ? { connectionStatus: body.connectionStatus } : {}),
    },
  });
  return NextResponse.json({ profile });
}

// DELETE /api/profiles/:id — "Delete imported data" for this profile.
// Cascades to its folders and bookmarks.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.chromeProfile.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
