import { getCapabilityReadiness } from "../../../../lib/env";
import { decryptConnectorSecret } from "../../../../lib/google/workspace";
import { getServerIdentity } from "../../../../lib/server/identity";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "edge";

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to view connectors." }, { status: 401 });
  const ready = getCapabilityReadiness();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Connector storage is unavailable." }, { status: 503 });
  const { data, error } = await supabase
    .from("integration_connection_summaries")
    .select("provider, account_email, scopes, status, last_used_at, expires_at, updated_at")
    .eq("owner_id", identity.userId)
    .eq("provider", "google_workspace")
    .maybeSingle();
  if (error) return Response.json({ error: "Connector status could not be loaded." }, { status: 503 });
  return Response.json({ configured: ready.googleWorkspace, connection: data });
}

export async function DELETE() {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to revoke connectors." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "Connector administration is not configured.", code: "OWNER_SETUP_REQUIRED" }, { status: 503 });
  try {
    const { data: secret, error: readError } = await admin.rpc("nook_get_google_connection_secret", { p_owner_id: identity.userId });
    if (readError) throw readError;
    const row = Array.isArray(secret) ? secret[0] : secret;
    if (row?.refresh_token_ciphertext && row?.refresh_token_iv) {
      const token = await decryptConnectorSecret(row.refresh_token_ciphertext, row.refresh_token_iv);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
    }
    const { error: revokeError } = await admin.rpc("nook_revoke_google_connection", { p_owner_id: identity.userId });
    if (revokeError) throw revokeError;
    return Response.json({ revoked: true });
  } catch (error) {
    console.error("google.workspace.revoke.failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Google Workspace could not be revoked right now." }, { status: 502 });
  }
}
