import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Catalog storage is unavailable." }, { status: 503 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  let query = supabase.from("catalog_items").select("*").order("name").limit(50);
  if (kind && ["cosmetic", "nook_pack", "behavior_pack"].includes(kind)) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) return Response.json({ error: "The catalog could not be loaded." }, { status: 503 });
  return Response.json({ items: data ?? [], mode: "platform_catalog" }, { headers: { "cache-control": "public, max-age=60" } });
}
