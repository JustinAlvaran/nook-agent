import { cookies } from "next/headers";
import { getServerEnvironment } from "../../../../../lib/env";
import { createOAuthNonce, createPkceChallenge, getGoogleScopes, isGoogleCapability } from "../../../../../lib/google/workspace";
import { getServerIdentity } from "../../../../../lib/server/identity";

export const runtime = "edge";

export async function GET(request: Request) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in before connecting Google Workspace." }, { status: 401 });
  const env = getServerEnvironment();
  if (!env.GOOGLE_WORKSPACE_CLIENT_ID || !env.GOOGLE_WORKSPACE_CLIENT_SECRET || !env.CONNECTOR_TOKEN_ENCRYPTION_KEY) {
    return Response.json({ error: "Google Workspace is not configured yet.", code: "OWNER_SETUP_REQUIRED" }, { status: 503 });
  }
  const url = new URL(request.url);
  const requested = url.searchParams.get("capability");
  const capability = isGoogleCapability(requested) ? requested : "read";
  const state = createOAuthNonce();
  const verifier = createOAuthNonce(48);
  const challenge = await createPkceChallenge(verifier);
  const callback = `${url.origin}/api/integrations/google/callback`;
  const cookieStore = await cookies();
  const cookieOptions = { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax" as const, maxAge: 600, path: "/api/integrations/google" };
  cookieStore.set("nook_google_oauth_state", state, cookieOptions);
  cookieStore.set("nook_google_pkce", verifier, cookieOptions);
  cookieStore.set("nook_google_capability", capability, cookieOptions);

  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({
    client_id: env.GOOGLE_WORKSPACE_CLIENT_ID,
    redirect_uri: callback,
    response_type: "code",
    scope: getGoogleScopes(capability).join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return Response.redirect(authorization, 302);
}
