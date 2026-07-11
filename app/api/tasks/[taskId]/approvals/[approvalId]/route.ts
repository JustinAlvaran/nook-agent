import { getServerIdentity } from "../../../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";

export const runtime = "edge";
type Context = { params: Promise<{ taskId: string; approvalId: string }> };

export async function POST(request: Request, context: Context) {
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
  if (Date.parse(approval.expires_at) <= Date.now()) return Response.json({ error: "This approval has expired." }, { status: 410 });
  if (decision === "approve" && approval.risk_class >= 3) {
    const { data: { user } } = await supabase.auth.getUser();
    const lastSignIn = user?.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
    if (Date.now() - lastSignIn > 10 * 60 * 1000) {
      return Response.json({ error: "Sign in again before approving this high-risk action.", code: "FRESH_AUTH_REQUIRED" }, { status: 428 });
    }
  }
  const { data, error } = await supabase.rpc("nook_decide_simulated_approval", {
    p_approval_id: approvalId,
    p_action_hash: actionHash,
    p_decision: decision,
  });
  if (error) return Response.json({ error: "The approval could not be recorded." }, { status: 409 });
  return Response.json({ result: Array.isArray(data) ? data[0] : data });
}
