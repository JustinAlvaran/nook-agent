import { authenticateBrowserDevice } from "../../../../../lib/browser/device-auth";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "edge";

export async function POST(request: Request) {
  const device = await authenticateBrowserDevice(request);
  if (!device)
    return Response.json({ error: "Browser device authentication failed." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin)
    return Response.json({ error: "Browser command storage is unavailable." }, { status: 503 });
  const { data, error } = await admin.rpc("nook_claim_browser_command", {
    p_token_hash: device.tokenHash,
  });
  if (error)
    return Response.json({ error: "Browser command claim failed." }, { status: 503 });
  const row = Array.isArray(data) ? data[0] : data;
  return Response.json(
    { command: row?.command || null, retryAfterMs: row?.command ? 250 : 1500 },
    { headers: { "cache-control": "no-store" } },
  );
}

