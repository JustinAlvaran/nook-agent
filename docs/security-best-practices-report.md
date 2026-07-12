# Security best-practices review

## Fixed in this branch

- Closed the OAuth `next=/\evil.example` open-redirect class with one allowlisted same-origin path helper.
- Removed a ChatGPT login option that did not create application identity.
- Made sign-out POST-only and added cross-site browser mutation rejection.
- Replaced model-authored broad capabilities with four strict allowlisted tools.
- Recomputed risk/approval from registry metadata and bound exact arguments to SHA-256.
- Revoked browser creation of authoritative task/step/approval rows and old forgeable run/finalize RPC execution.
- Added short-lived Worker HMAC authorization, atomic execution claims, bounded attempts, transactional failure/cancel/retry, task events, execution attempts, and receipt truth.
- Filtered task memory by both owner and Nook.
- Made preference changes approval-gated, transactional, reversible, and re-read before success.
- Added accessible motion/drag alternatives and WebGL fallback.

## Open risks by priority

P0 before broad production: bootstrap/rotate the new HMAC in both Sites and Supabase; run two-user database/RPC integration tests; add a validated Supabase SSR refresh Proxy; rotate every credential previously pasted into chat; add platform rate limits.

P1 before connectors: canonical `APP_URL` for every OAuth/payment return; user-bound OAuth state records; envelope encryption; scope/revocation reconciliation; Cloudflare Workflow/Queue idempotency; prompt-injection fixtures; dedicated fresh-auth/MFA proof.

P1 before payments/creators: verified Stripe webhook-only entitlement grants; disputes/refunds; storage quarantine; content/license/moderation validation; seller verification and recall process.

P2 quality: reduce public capability detail in health output; remove dormant D1/Drizzle code and stale historical architecture; add CSP/security header regression tests; code-split remaining large client chunks.
