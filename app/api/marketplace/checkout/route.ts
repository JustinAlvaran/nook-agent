import { getServerEnvironment } from "../../../../lib/env";
import { getServerIdentity } from "../../../../lib/server/identity";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "edge";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in to add marketplace items." }, { status: 401 });
  let body: { listingId?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const listingId = typeof body.listingId === "string" && UUID.test(body.listingId) ? body.listingId : "";
  if (!listingId) return Response.json({ error: "A valid listing ID is required." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Marketplace storage is unavailable." }, { status: 503 });
  const { data: listing, error: listingError } = await supabase.from("catalog_items").select("listing_id,name,price_amount,currency").eq("listing_id", listingId).maybeSingle();
  if (listingError || !listing) return Response.json({ error: "This listing is unavailable." }, { status: 404 });
  if (listing.price_amount === 0) {
    const { data, error } = await supabase.rpc("nook_claim_free_listing", { p_listing_id: listingId });
    if (error) return Response.json({ error: "The free item could not be added." }, { status: 409 });
    return Response.json({ claimed: true, entitlementId: data });
  }

  const env = getServerEnvironment();
  const admin = createSupabaseAdminClient();
  if (!env.STRIPE_SECRET_KEY || !admin) return Response.json({ error: "Test checkout is not configured yet.", code: "OWNER_SETUP_REQUIRED" }, { status: 503 });
  const { data: orderData, error: orderError } = await admin.rpc("nook_create_checkout_order", { p_owner_id: identity.userId, p_listing_id: listingId });
  const order = Array.isArray(orderData) ? orderData[0] : orderData;
  if (orderError || !order) return Response.json({ error: "A checkout order could not be created." }, { status: 409 });
  const idempotencyKey = `checkout_${order.order_id}`;
  const requestUrl = new URL(request.url);
  const stripeBody = new URLSearchParams({
    mode: "payment",
    success_url: `${requestUrl.origin}/dashboard/wardrobe?checkout=success`,
    cancel_url: `${requestUrl.origin}/dashboard/marketplace?checkout=cancelled`,
    client_reference_id: order.order_id,
    "metadata[order_id]": order.order_id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": order.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(order.unit_amount),
    "line_items[0][price_data][product_data][name]": order.title,
  });
  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": idempotencyKey },
    body: stripeBody,
  });
  const session = await stripeResponse.json() as { id?: string; url?: string; expires_at?: number; error?: { message?: string } };
  if (!stripeResponse.ok || !session.id || !session.url) {
    await admin.from("orders").update({ status: "failed" }).eq("id", order.order_id);
    return Response.json({ error: "Stripe test checkout could not be created." }, { status: 502 });
  }
  const { error: storeError } = await admin.rpc("nook_store_payment_session", {
    p_order_id: order.order_id,
    p_provider_session_id: session.id,
    p_idempotency_key: idempotencyKey,
    p_expires_at: new Date((session.expires_at ?? Math.floor(Date.now() / 1000) + 1800) * 1000).toISOString(),
  });
  if (storeError) return Response.json({ error: "Checkout was created but could not be recorded. Do not pay; retry later." }, { status: 502 });
  return Response.json({ checkoutUrl: session.url, orderId: order.order_id });
}
