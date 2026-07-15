import { getServerIdentity } from "../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "edge";

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to view what Nook remembers." },
      { status: 401 },
    );
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json({ error: "Memory is unavailable." }, { status: 503 });
  const { data, error } = await supabase
    .from("nook_memories")
    .select("id,kind,content,source,created_at")
    .eq("owner_id", identity.userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error)
    return Response.json(
      { error: "Nook could not load its memory." },
      { status: 503 },
    );
  return Response.json({ memories: data ?? [] });
}

export async function POST(request: Request) {
  void request;
  return Response.json(
    {
      error:
        "Direct memory activation is disabled. Create a memory proposal and review it first.",
      code: "MEMORY_REVIEW_REQUIRED",
    },
    { status: 405 },
  );
}
