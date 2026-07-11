import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerEnvironment } from "../../../../../lib/env";
import { encryptConnectorSecret, getGoogleScopes, isGoogleCapability } from "../../../../../lib/google/workspace";
import { getServerIdentity } from "../../../../../lib/server/identity";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "edge";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirect = (status: string) => NextResponse.redirect(new URL(`/dashboard/permissions?google=${status}`, requestUrl.origin), 303);
  const identity = await getServerIdentity();
  if (!identity) return redirect("signin-required");
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("nook_google_oauth_state")?.value;
  const verifier = cookieStore.get("nook_google_pkce")?.value;
  const requestedCapability = cookieStore.get("nook_google_capability")?.value ?? "read";
  ["nook_google_oauth_state", "nook_google_pkce", "nook_google_capability"].forEach((name) => cookieStore.delete(name));
  if (!code || !state || state !== expectedState || !verifier) return redirect("invalid-state");

  try {
    const env = getServerEnvironment();
    if (!env.GOOGLE_WORKSPACE_CLIENT_ID || !env.GOOGLE_WORKSPACE_CLIENT_SECRET) return redirect("owner-setup-required");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_WORKSPACE_CLIENT_ID,
        client_secret: env.GOOGLE_WORKSPACE_CLIENT_SECRET,
        redirect_uri: `${requestUrl.origin}/api/integrations/google/callback`,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) return redirect("exchange-failed");
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!token.access_token || !token.refresh_token) return redirect("offline-access-required");
    const accountResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    if (!accountResponse.ok) return redirect("account-read-failed");
    const account = await accountResponse.json() as { sub?: string; email?: string };
    if (!account.sub || !account.email) return redirect("account-read-failed");
    const encrypted = await encryptConnectorSecret(token.refresh_token);
    const admin = createSupabaseAdminClient();
    if (!admin) return redirect("owner-setup-required");
    const capability = isGoogleCapability(requestedCapability) ? requestedCapability : "read";
    const { error } = await admin.rpc("nook_store_google_connection", {
      p_owner_id: identity.userId,
      p_provider_subject: account.sub,
      p_account_email: account.email,
      p_scopes: token.scope?.split(" ").filter(Boolean) ?? getGoogleScopes(capability),
      p_refresh_token_ciphertext: encrypted.ciphertext,
      p_refresh_token_iv: encrypted.iv,
      p_key_version: encrypted.keyVersion,
      p_access_token_expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
    });
    if (error) throw error;
    return redirect("connected");
  } catch (error) {
    console.error("google.workspace.callback.failed", error instanceof Error ? error.message : "unknown");
    return redirect("failed");
  }
}
