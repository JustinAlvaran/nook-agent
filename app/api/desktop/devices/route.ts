import { getServerIdentity } from "../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "edge";

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to view paired devices." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Device storage is unavailable." }, { status: 503 });
  const { data, error } = await supabase.from("devices").select("id, name, platform, status, last_seen_at, created_at, revoked_at").eq("owner_id", identity.userId).order("created_at", { ascending: false });
  if (error) return Response.json({ error: "Paired devices could not be loaded." }, { status: 503 });
  return Response.json({ devices: data ?? [] });
}

export async function DELETE(request: Request) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to revoke a device." }, { status: 401 });
  const deviceId = new URL(request.url).searchParams.get("id");
  if (!deviceId) return Response.json({ error: "A device ID is required." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Device storage is unavailable." }, { status: 503 });
  const { error } = await supabase.from("devices").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", deviceId).eq("owner_id", identity.userId);
  if (error) return Response.json({ error: "The device could not be revoked." }, { status: 503 });
  return Response.json({ revoked: true });
}
