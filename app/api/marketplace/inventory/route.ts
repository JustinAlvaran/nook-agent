import { getServerIdentity } from "../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "edge";

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to view your wardrobe." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Inventory storage is unavailable." }, { status: 503 });
  const [{ data: entitlements, error: entitlementError }, { data: loadout, error: loadoutError }] = await Promise.all([
    supabase.from("entitlements").select("id, product_id, product_version_id, status, source, granted_at").eq("owner_id", identity.userId).eq("status", "active"),
    supabase.from("nook_loadout").select("nook_id, slot, entitlement_id, equipped_at"),
  ]);
  if (entitlementError || loadoutError) return Response.json({ error: "Your wardrobe could not be loaded." }, { status: 503 });
  return Response.json({ entitlements: entitlements ?? [], loadout: loadout ?? [] });
}
