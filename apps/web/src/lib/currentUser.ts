import { prisma } from "./db";

/**
 * Local-first MVP has no real Google OAuth — there is a single local
 * account, auto-created on first use. Swapping this for real auth later
 * only requires changing this function's implementation.
 */
export async function getOrCreateLocalUser() {
  const email = "local@ai-website-organizer.app";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      email,
      name: "Local User",
    },
  });
}
