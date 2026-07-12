import { validateMemoryContent } from "../../../../lib/agent/memory-policy";
import { rejectCrossSiteMutation } from "../../../../lib/server/request-security";
import { getServerIdentity } from "../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
export const runtime = "edge";
type Context = { params: Promise<{ proposalId: string }> };
export async function PATCH(request: Request, context: Context) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to edit memory proposals." },
      { status: 401 },
    );
  let body: { content?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const checked = validateMemoryContent(
    typeof body.content === "string" ? body.content : "",
  );
  if (!checked.ok)
    return Response.json({ error: checked.error }, { status: 400 });
  const { proposalId } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json(
      { error: "Memory proposals are unavailable." },
      { status: 503 },
    );
  const { data, error } = await supabase
    .from("memory_proposals")
    .update({ content: checked.content })
    .eq("id", proposalId)
    .eq("owner_id", identity.userId)
    .eq("status", "proposed")
    .select("*")
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "Memory proposal could not be updated." },
      { status: 503 },
    );
  if (!data)
    return Response.json(
      { error: "Active proposal not found." },
      { status: 404 },
    );
  return Response.json({ proposal: data });
}
