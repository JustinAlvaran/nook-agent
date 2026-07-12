import { getServerIdentity } from "../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { validateMemoryContent } from "../../../../lib/agent/memory-policy";
import { rejectCrossSiteMutation } from "../../../../lib/server/request-security";

export const runtime = "edge";
type Context = { params: Promise<{ memoryId: string }> };

export async function PATCH(request: Request, context: Context) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to edit Nook's memory." },
      { status: 401 },
    );
  const { memoryId } = await context.params;
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
  const content = checked.content;
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json({ error: "Memory is unavailable." }, { status: 503 });
  const { data, error } = await supabase
    .from("nook_memories")
    .update({ content })
    .eq("id", memoryId)
    .eq("owner_id", identity.userId)
    .eq("status", "active")
    .select("id,kind,content,source,created_at")
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "Nook could not update that memory." },
      { status: 503 },
    );
  if (!data)
    return Response.json({ error: "Memory not found." }, { status: 404 });
  return Response.json({ memory: data });
}

export async function DELETE(_request: Request, context: Context) {
  const rejected = rejectCrossSiteMutation(_request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to edit Nook's memory." },
      { status: 401 },
    );
  const { memoryId } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json({ error: "Memory is unavailable." }, { status: 503 });
  const { data, error } = await supabase
    .from("nook_memories")
    .update({ status: "archived" })
    .eq("id", memoryId)
    .eq("owner_id", identity.userId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "Nook could not forget that memory." },
      { status: 503 },
    );
  if (!data)
    return Response.json({ error: "Memory not found." }, { status: 404 });
  return Response.json({ archived: true });
}
