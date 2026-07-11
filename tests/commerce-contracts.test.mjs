import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyStripeSignature } from "../lib/stripe/webhook.ts";

test("Stripe webhook verification binds the raw payload and timestamp", async () => {
  const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
  const secret = "whsec_nook_test_secret";
  const timestamp = 1_800_000_000;
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  assert.equal(await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp * 1000), true);
  assert.equal(await verifyStripeSignature(`${payload} `, `t=${timestamp},v1=${signature}`, secret, timestamp * 1000), false);
  assert.equal(await verifyStripeSignature(payload, `t=${timestamp - 301},v1=${signature}`, secret, timestamp * 1000), false);
});
