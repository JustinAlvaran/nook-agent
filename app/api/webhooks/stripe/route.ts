import { getServerEnvironment } from "../../../../lib/env";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { verifyStripeSignature } from "../../../../lib/stripe/webhook";
import type { Json } from "../../../../lib/supabase/database.types";

export const runtime = "edge";

export async function POST(request: Request) {
  const env = getServerEnvironment();
  if (!env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  const signature = request.headers.get("stripe-signature") ?? "";
  const rawBody = await request.text();
  if (!(await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET))) return Response.json({ error: "Invalid signature." }, { status: 400 });
  let event: ({ id?: string; type?: string } & Record<string, unknown>);
  let payload: Json;
  try { event = JSON.parse(rawBody) as typeof event; payload = event as Json; }
  catch { return Response.json({ error: "Invalid event JSON." }, { status: 400 }); }
  if (!event.id || !event.type) return Response.json({ error: "Incomplete Stripe event." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: "Webhook storage is unavailable." }, { status: 503 });
  const { data, error } = await admin.rpc("nook_process_stripe_webhook", { p_event_id: event.id, p_event_type: event.type, p_payload: payload });
  if (error) return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  return Response.json({ received: true, status: data });
}
