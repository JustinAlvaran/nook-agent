import { getServerIdentity } from "../../../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";
import { rejectCrossSiteMutation } from "../../../../../../lib/server/request-security";

export const runtime = "edge";
type Context = { params: Promise<{ taskId: string; approvalId: string }> };

export async function POST(request: Request, context: Context) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to decide this approval." }, { status: 401 });
  const { taskId, approvalId } = await context.params;
  let body: { decision?: unknown; actionHash?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : null;
  const actionHash = typeof body.actionHash === "string" ? body.actionHash : "";
  if (!decision || !/^[a-f0-9]{64}$/.test(actionHash)) return Response.json({ error: "The approval decision is invalid." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Approval storage is unavailable." }, { status: 503 });
  const { data: approval, error: readError } = await supabase
    .from("approvals")
    .select("id, task_id, risk_class, status, action_hash, expires_at")
    .eq("id", approvalId)
    .eq("task_id", taskId)
    .eq("owner_id", identity.userId)
    .maybeSingle();
  if (readError) return Response.json({ error: "The approval could not be loaded." }, { status: 503 });
  if (!approval || approval.status !== "pending" || approval.action_hash !== actionHash) return Response.json({ error: "This approval is unavailable or has changed." }, { status: 409 });
  if (approval.risk_class >= 2) return Response.json({ error: "This MVP does not authorize external or high-risk effects." }, { status: 409 });
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("nook_decide_approval", {
    p_approval_id: approvalId,
    p_action_hash: actionHash,
    p_decision: decision,
  });
  if (error) return Response.json({ error: "The approval could not be recorded." }, { status: 409 });
  return Response.json({ result: Array.isArray(data) ? data[0] : data });
}
