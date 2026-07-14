import { validateMemoryContent } from "../../../../../lib/agent/memory-policy";
import { rejectCrossSiteMutation } from "../../../../../lib/server/request-security";
import { getServerIdentity } from "../../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
export const runtime = "edge";
type Context = { params: Promise<{ proposalId: string }> };
export async function POST(request: Request, context: Context) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to review memory proposals." },
      { status: 401 },
    );
  let body: { decision?: unknown; content?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const decision = String(body.decision ?? "");
  if (decision !== "approve" && decision !== "reject")
    return Response.json(
      { error: "Decision must be approve or reject." },
      { status: 400 },
    );
  let content: string | null = null;
  if (body.content !== undefined) {
    const checked = validateMemoryContent(String(body.content));
    if (!checked.ok)
      return Response.json({ error: checked.error }, { status: 400 });
    content = checked.content;
  }
  const { proposalId } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json(
      { error: "Memory proposals are unavailable." },
      { status: 503 },
    );
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("nook_review_memory_proposal", {
    p_proposal_id: proposalId,
    p_decision: decision,
    p_content: content,
  });
  if (error)
    return Response.json(
      {
        error: error.message.includes("not_found")
          ? "Active proposal not found."
          : "Memory proposal could not be reviewed.",
      },
      { status: error.message.includes("not_found") ? 404 : 409 },
    );
  return Response.json({ decision, memoryId: data });
}
