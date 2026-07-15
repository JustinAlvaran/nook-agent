import { getServerIdentity } from "../../../../../lib/server/identity";
import { rejectCrossSiteMutation } from "../../../../../lib/server/request-security";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "edge";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json({ error: "Sign in to stop a browser command." }, { status: 401 });
  let body: { commandId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const commandId = typeof body.commandId === "string" ? body.commandId : "";
  if (!/^[0-9a-f-]{36}$/i.test(commandId))
    return Response.json({ error: "A valid browser command ID is required." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin)
    return Response.json({ error: "Browser command storage is unavailable." }, { status: 503 });
  const { data, error } = await admin.rpc("nook_expire_browser_command", {
    p_owner_id: identity.userId,
    p_command_id: commandId,
  });
  if (error)
    return Response.json({ error: "The browser command could not be stopped." }, { status: 503 });
  return Response.json({ stopped: Boolean(data) });
}

