import { getServerIdentity } from "../../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
export const runtime = "edge";
type Context = { params: Promise<{ taskId: string }> };
export async function GET(_request: Request, context: Context) {
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to inspect task memory." },
      { status: 401 },
    );
  const { taskId } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json(
      { error: "Memory audit is unavailable." },
      { status: 503 },
    );
  const { data, error } = await supabase
    .from("task_memory_usage")
    .select("reason,created_at,nook_memories(id,kind,content)")
    .eq("task_id", taskId)
    .eq("owner_id", identity.userId);
  if (error)
    return Response.json(
      { error: "Memory audit could not be loaded." },
      { status: 503 },
    );
  return Response.json({ memoriesUsed: data ?? [] });
}
