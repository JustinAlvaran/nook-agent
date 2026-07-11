import { getServerIdentity } from "../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "edge";
type Context = { params: Promise<{ memoryId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to edit Nook's memory." }, { status: 401 });
  const { memoryId } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Memory is unavailable." }, { status: 503 });
  const { data, error } = await supabase.from("nook_memories").update({ status: "archived" }).eq("id", memoryId).eq("owner_id", identity.userId).eq("status", "active").select("id").maybeSingle();
  if (error) return Response.json({ error: "Nook could not forget that memory." }, { status: 503 });
  if (!data) return Response.json({ error: "Memory not found." }, { status: 404 });
  return Response.json({ archived: true });
}
