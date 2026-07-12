import { ensureProfileAndNook, getServerIdentity } from "../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { rejectCrossSiteMutation } from "../../../lib/server/request-security";

const HEX = /^#[0-9a-f]{6}$/i;
const workingStyles = new Set(["calm", "quick", "curious"]);
const outfits = new Set(["none", "hoodie", "varsity", "utility"]);
const accessories = new Set(["none", "cap", "star", "antenna"]);
const initiatives = new Set(["low", "balanced", "proactive"]);
const explanationDepths = new Set(["brief", "clear", "deep"]);
const updateFrequencies = new Set(["quiet", "milestones", "frequent"]);

export const runtime = "edge";

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to view your Nook." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Nook storage is unavailable." }, { status: 503 });
  const { data, error } = await supabase
    .from("nooks")
    .select("*, appearance_versions(*)")
    .eq("owner_id", identity.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return Response.json({ error: "Your Nook could not be loaded." }, { status: 503 });
  return Response.json({ nook: data });
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in with Google or GitHub to save your Nook." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim() : "Orbit";
  if (!/^[\p{L}\p{N} _-]{1,24}$/u.test(name)) return Response.json({ error: "Nook's name must be 1-24 letters, numbers, spaces, underscores, or hyphens." }, { status: 400 });
  const workingStyle = workingStyles.has(String(body.workingStyle)) ? String(body.workingStyle) : "calm";
  const primary = typeof body.primary === "string" && HEX.test(body.primary) ? body.primary : "#617fff";
  const secondary = typeof body.secondary === "string" && HEX.test(body.secondary) ? body.secondary : "#9db0ff";
  const faceGlow = typeof body.faceGlow === "string" && HEX.test(body.faceGlow) ? body.faceGlow : "#7debff";
  const outfit = outfits.has(String(body.outfit)) ? String(body.outfit) : "hoodie";
  const accessory = accessories.has(String(body.accessory)) ? String(body.accessory) : "star";
  const behaviorSettings = {
    initiative: initiatives.has(String(body.initiative)) ? String(body.initiative) : "balanced",
    explanationDepth: explanationDepths.has(String(body.explanationDepth)) ? String(body.explanationDepth) : "clear",
    updateFrequency: updateFrequencies.has(String(body.updateFrequency)) ? String(body.updateFrequency) : "milestones",
  };

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const nook = await ensureProfileAndNook(identity, name || "Orbit");
    const { data: currentAppearance } = await supabase.from("appearance_versions").select("id,primary_color,secondary_color,face_glow,outfit_id,accessory_ids")
      .eq("nook_id", nook.id).eq("id", nook.active_appearance_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
    const requestedAccessories = accessory === "none" ? [] : [accessory];
    const appearanceUnchanged = currentAppearance && currentAppearance.primary_color.toLowerCase() === primary.toLowerCase()
      && currentAppearance.secondary_color.toLowerCase() === secondary.toLowerCase() && currentAppearance.face_glow.toLowerCase() === faceGlow.toLowerCase()
      && currentAppearance.outfit_id === outfit && JSON.stringify(currentAppearance.accessory_ids) === JSON.stringify(requestedAccessories);
    if (appearanceUnchanged) {
      const { data: saved, error: saveError } = await supabase.from("nooks").update({ name, working_style: workingStyle, behavior_settings: behaviorSettings })
        .eq("id", nook.id).eq("owner_id", identity.userId).select("*").single();
      if (saveError) throw saveError;
      return Response.json({ nook: saved, appearance: currentAppearance, appearanceVersionCreated: false });
    }
    const nextVersion = Number(nook.appearance_version ?? 0) + 1;
    const { data: appearance, error: appearanceError } = await supabase
      .from("appearance_versions")
      .insert({
        nook_id: nook.id,
        version: nextVersion,
        primary_color: primary,
        secondary_color: secondary,
        face_glow: faceGlow,
        outfit_id: outfit,
        accessory_ids: accessory === "none" ? [] : [accessory],
      })
      .select("id")
      .single();
    if (appearanceError) throw appearanceError;
    const { data: saved, error: saveError } = await supabase
      .from("nooks")
      .update({
        name: name || "Orbit",
        working_style: workingStyle,
        behavior_settings: behaviorSettings,
        active_appearance_id: appearance.id,
        appearance_version: nextVersion,
      })
      .eq("id", nook.id)
      .eq("owner_id", identity.userId)
      .select("*")
      .single();
    if (saveError) throw saveError;
    return Response.json({ nook: saved, appearance, appearanceVersionCreated: true });
  } catch (error) {
    console.error("nook.save.failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Your Nook could not be saved right now." }, { status: 503 });
  }
}
