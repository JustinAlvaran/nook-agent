# Nook database foundation

Supabase Auth and Postgres are the sole system of record. Cloudflare Sites serves the product and Cloudflare Workflows coordinates retries, timers, and approval pauses, but workflow payloads contain identifiers rather than credentials or canonical business state.

## Data boundaries

- `public` contains RLS-protected profiles, Nooks, immutable looks, task plans and receipts, desktop devices and grants, the reviewed catalog, orders, and user entitlements.
- `private` is not exposed through the Data API. It contains encrypted Google Workspace refresh tokens, provider payment identifiers, raw webhook events, and security events.
- `catalog_items` is a `security_invoker` projection over published products, versions, listings, prices, and approved preview metadata.
- Creator packages are declarative assets and manifests. They never contain executable JavaScript, WASM, binaries, or shell code.

The task API writes plans, steps, and a possible approval checkpoint through `nook_create_planned_task`, so a partial plan cannot become visible. `nook_decide_simulated_approval` locks the pending checkpoint, compares the approved action hash, transitions the task and step, and appends a receipt exactly once. Google credential and device-pairing RPCs are executable only by `service_role`; authenticated clients can see connection summaries and their device metadata but never refresh-token ciphertext or device token hashes.

Client code receives only the Supabase publishable key. The service-role key, connector encryption key, Google client secret, OpenAI key, and payment webhook secrets belong in separate Cloudflare secrets for development, staging, and production. Google login and Google Workspace authorization remain separate consent boundaries.

## Commerce invariant

The checkout return URL never grants a purchase. A Cloudflare endpoint verifies the provider signature over the raw webhook body, inserts the unique provider event into `private.webhook_inbox`, and acknowledges quickly. A Workflow then calls a server-only transaction that locks the affected order, applies a monotonic payment transition, creates immutable order-item snapshots, and grants an entitlement. Refunds and disputes create separate reversals and suspend or revoke entitlements according to policy.

## D1 retirement

D1 must not remain a second application database. Before public launch, migrate any useful prelaunch rows once, switch all reads and writes to Supabase, then remove the D1 binding. If anonymous catalog traffic later requires edge acceleration, use a disposable cache or projection that can be rebuilt from Postgres; never replicate orders, entitlements, approvals, device credentials, or integration state into D1.

## Applying and checking

The migration is intentionally local and has not been applied remotely. Apply it first to a disposable local Supabase stack, run `supabase/tests/production_foundation.sql` with `ON_ERROR_STOP=1`, inspect database/security advisors, and only then promote the exact migration through staging to production.

The migration creates database metadata for uploaded assets but does not create Supabase Storage buckets or their object policies. Add quarantine and published buckets in a later migration once upload limits, canonicalization jobs, retention, and moderation are implemented.
