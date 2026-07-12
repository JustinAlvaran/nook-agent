import { getServerIdentity } from "../../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
export const runtime = "edge";
type Context = { params: Promise<{ taskId: string }> };
export async function GET(_request: Request, context: Context) {
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to view research." },
      { status: 401 },
    );
  const { taskId } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json(
      { error: "Research is unavailable." },
      { status: 503 },
    );
  const { data, error } = await supabase
    .from("research_runs")
    .select(
      "id,query,freshness,provider,status,searched_at,metadata,research_sources(id,title,url,source_name,published_at,retrieved_at,snippet)",
    )
    .eq("task_id", taskId)
    .eq("owner_id", identity.userId)
    .order("searched_at", { ascending: false });
  if (error)
    return Response.json(
      { error: "Research could not be loaded." },
      { status: 503 },
    );
  return Response.json({ research: data ?? [] });
}
