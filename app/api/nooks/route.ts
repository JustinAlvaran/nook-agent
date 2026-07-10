import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { nookAppearances, nooks } from "../../../db/schema";
import { ensureProfileAndNook, getServerIdentity } from "../../../lib/server/identity";

const HEX = /^#[0-9a-f]{6}$/i;

export async function POST(request: Request) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to save your Nook." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 24) : "Orbit";
  const workingStyle = ["calm", "quick", "curious"].includes(String(body.workingStyle)) ? String(body.workingStyle) : "calm";
  const primary = typeof body.primary === "string" && HEX.test(body.primary) ? body.primary : "#617fff";
  const secondary = typeof body.secondary === "string" && HEX.test(body.secondary) ? body.secondary : "#9db0ff";
  const faceGlow = typeof body.faceGlow === "string" && HEX.test(body.faceGlow) ? body.faceGlow : "#7debff";
  const outfit = ["none", "hoodie", "varsity", "utility"].includes(String(body.outfit)) ? String(body.outfit) : "hoodie";
  const accessory = ["none", "cap", "star", "antenna"].includes(String(body.accessory)) ? String(body.accessory) : "star";

  try {
    const db = getDb();
    const nook = await ensureProfileAndNook(identity, name || "Orbit");
    const appearanceId = `look_${crypto.randomUUID()}`;
    await db.insert(nookAppearances).values({ id: appearanceId, nookId: nook.id, primaryColor: primary, secondaryColor: secondary, faceGlow, outfitId: outfit, accessoryIdsJson: JSON.stringify(accessory === "none" ? [] : [accessory]) });
    await db.update(nooks).set({ name: name || "Orbit", workingStyle, activeAppearanceId: appearanceId, updatedAt: new Date().toISOString() }).where(eq(nooks.id, nook.id));
    return Response.json({ nook: { ...nook, name: name || "Orbit", workingStyle, activeAppearanceId: appearanceId } });
  } catch {
    return Response.json({ error: "Your Nook could not be saved right now." }, { status: 503 });
  }
}
