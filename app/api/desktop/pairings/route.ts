import { createPairingCode, hashSecret } from "../../../../lib/desktop/security";
import { getServerIdentity } from "../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "edge";

export async function POST() {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to pair Nook Desktop." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Pairing storage is unavailable." }, { status: 503 });
  const code = createPairingCode();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from("device_pairings").insert({ owner_id: identity.userId, code_hash: codeHash, expires_at: expiresAt });
  if (error) return Response.json({ error: "A pairing code could not be created." }, { status: 503 });
  return Response.json({ code, expiresAt }, { headers: { "cache-control": "no-store" } });
}
