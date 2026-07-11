import { ensureProfileAndNook, getServerIdentity } from "../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "edge";
const kinds = new Set(["preference", "instruction", "context"]);

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to view what Nook remembers." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Memory is unavailable." }, { status: 503 });
  const { data, error } = await supabase.from("nook_memories").select("id,kind,content,source,created_at").eq("owner_id", identity.userId).eq("status", "active").order("updated_at", { ascending: false });
  if (error) return Response.json({ error: "Nook could not load its memory." }, { status: 503 });
  return Response.json({ memories: data ?? [] });
}

export async function POST(request: Request) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in before teaching Nook." }, { status: 401 });
  let body: { kind?: unknown; content?: unknown; source?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const kind = String(body.kind ?? "");
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const source = "taught" as const;
  if (!kinds.has(kind) || content.length < 2 || content.length > 500) return Response.json({ error: "Choose a memory type and enter 2–500 characters." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Memory is unavailable." }, { status: 503 });
  try {
    const nook = await ensureProfileAndNook(identity);
    const { data, error } = await supabase.from("nook_memories").upsert({ owner_id: identity.userId, nook_id: nook.id, kind, content, source, status: "active" }, { onConflict: "owner_id,nook_id,kind,content" }).select("id,kind,content,source,created_at").single();
    if (error) throw error;
    return Response.json({ memory: data }, { status: 201 });
  } catch {
    return Response.json({ error: "Nook could not save that memory." }, { status: 503 });
  }
}
