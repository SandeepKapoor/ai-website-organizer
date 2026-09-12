import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateLocalUser } from "@/lib/currentUser";

// POST /api/profiles/connect
// Body: { profileName: string }
// Creates (or reconnects) a ChromeProfile for the local user and returns
// its id, which the extension then uses for every subsequent sync call.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const profileName = typeof body?.profileName === "string" ? body.profileName.trim() : "";

  if (!profileName) {
    return NextResponse.json({ error: "profileName is required" }, { status: 400 });
  }

  const user = await getOrCreateLocalUser();

  let profile = await prisma.chromeProfile.findFirst({
    where: { userId: user.id, profileName },
  });

  if (profile) {
    profile = await prisma.chromeProfile.update({
      where: { id: profile.id },
      data: { connectionStatus: "connected" },
    });
  } else {
    profile = await prisma.chromeProfile.create({
      data: { userId: user.id, profileName, connectionStatus: "connected" },
    });
  }

  return NextResponse.json({ profileId: profile.id, profileName: profile.profileName });
}

export async function GET() {
  const user = await getOrCreateLocalUser();
  const profiles = await prisma.chromeProfile.findMany({
    where: { userId: user.id },
    include: { _count: { select: { bookmarks: { where: { isDeleted: false } } } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    profiles: profiles.map((p) => ({
      id: p.id,
      profileName: p.profileName,
      connectionStatus: p.connectionStatus,
      lastSyncedAt: p.lastSyncedAt,
      bookmarkCount: p._count.bookmarks,
    })),
  });
}
