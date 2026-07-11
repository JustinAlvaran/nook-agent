import { createDeviceToken, hashSecret } from "../../../../../lib/desktop/security";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "edge";

export async function POST(request: Request) {
  let body: { code?: unknown; deviceName?: unknown; publicKey?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const deviceName = typeof body.deviceName === "string" ? body.deviceName.trim().slice(0, 80) : "Windows PC";
  const publicKey = typeof body.publicKey === "string" ? body.publicKey.trim() : "";
  if (!/^[A-Z2-9]{8}$/.test(code) || publicKey.length < 32 || publicKey.length > 4096) {
    return Response.json({ error: "The pairing request is invalid." }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "Desktop pairing is not enabled yet.", code: "OWNER_SETUP_REQUIRED" }, { status: 503 });
  const deviceToken = createDeviceToken();
  const [{ codeHash }, { tokenHash }] = await Promise.all([
    hashSecret(code).then((codeHash) => ({ codeHash })),
    hashSecret(deviceToken).then((tokenHash) => ({ tokenHash })),
  ]);
  const { data, error } = await admin.rpc("nook_redeem_device_pairing", {
    p_code_hash: codeHash,
    p_device_name: deviceName,
    p_public_key: publicKey,
    p_token_hash: tokenHash,
  });
  if (error || !data) return Response.json({ error: "This pairing code is invalid or expired." }, { status: 409 });
  const device = Array.isArray(data) ? data[0] : data;
  const deviceId = typeof device === "string" ? device : device?.device_id;
  if (!deviceId) return Response.json({ error: "The pairing response was incomplete." }, { status: 502 });
  return Response.json({ deviceId, deviceToken }, { headers: { "cache-control": "no-store" } });
}
