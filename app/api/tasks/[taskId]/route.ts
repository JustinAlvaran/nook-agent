import { getServerIdentity } from "../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "edge";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, context: Context) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to view this task." }, { status: 401 });
  const { taskId } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Task storage is unavailable." }, { status: 503 });
  const { data, error } = await supabase.from("tasks").select("*, task_steps(*), approvals(*), action_receipts(*)").eq("id", taskId).eq("owner_id", identity.userId).maybeSingle();
  if (error) return Response.json({ error: "The task could not be loaded." }, { status: 503 });
  if (!data) return Response.json({ error: "Task not found." }, { status: 404 });
  return Response.json({ task: data });
}

export async function PATCH(request: Request, context: Context) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to update this task." }, { status: 401 });
  const { taskId } = await context.params;
  let body: { action?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (body.action !== "cancel" && body.action !== "retry") return Response.json({ error: "Action must be cancel or retry." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Task storage is unavailable." }, { status: 503 });
  const allowed = body.action === "cancel" ? ["draft", "planning", "policy_review", "ready", "running", "awaiting_approval", "retry_wait"] : ["failed", "blocked"];
  const next = body.action === "cancel" ? "cancelled" : "ready";
  const { data, error } = await supabase.from("tasks").update({ status: next }).eq("id", taskId).eq("owner_id", identity.userId).in("status", allowed).select("id,status").maybeSingle();
  if (error) return Response.json({ error: "The task could not be updated." }, { status: 503 });
  if (!data) return Response.json({ error: "The task is no longer in a compatible state." }, { status: 409 });
  return Response.json({ task: data });
}
