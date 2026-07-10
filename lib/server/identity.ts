import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../app/chatgpt-auth";
import { getDb } from "../../db";
import { nooks, profiles } from "../../db/schema";

export async function getServerIdentity() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const bytes = new TextEncoder().encode(user.email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const userId = `chatgpt_${Array.from(new Uint8Array(digest)).slice(0, 16).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return { ...user, userId };
}

export async function ensureProfileAndNook(identity: NonNullable<Awaited<ReturnType<typeof getServerIdentity>>>, nookName = "Orbit") {
  const db = getDb();
  await db.insert(profiles).values({
    userId: identity.userId,
    email: identity.email,
    displayName: identity.displayName,
    onboardingState: "active",
  }).onConflictDoUpdate({
    target: profiles.userId,
    set: { displayName: identity.displayName, updatedAt: new Date().toISOString() },
  });

  const [existing] = await db.select().from(nooks).where(eq(nooks.ownerUserId, identity.userId)).limit(1);
  if (existing) return existing;
  const id = `nook_${crypto.randomUUID()}`;
  const [created] = await db.insert(nooks).values({ id, ownerUserId: identity.userId, name: nookName }).returning();
  return created;
}
