# Security model

Protected assets are account identity, Nook configuration, user prompts/memories, authoritative plans, approvals, execution provenance, connector tokens, payment state, and future device grants.

Primary attackers are anonymous callers, one signed-in user attacking another, a signed-in owner trying to forge provenance, malicious prompt/connector content, replaying clients, and compromised browser scripts.

Implemented controls:

- verified Supabase identity and owner-derived queries;
- explicit grants plus RLS; private schema closed to browser roles;
- authoritative lifecycle writes require short-lived Worker HMAC authorization;
- strict allowlisted tool schemas and server-side risk/approval recomputation;
- immutable action hashes checked again after claim;
- atomic claim/finalize/fail/cancel/retry and bounded attempts;
- approval exact-once, hash-bound, expiring, and separate from execution;
- no arbitrary URLs, server fetches, shell, filesystem, payment, or external connector effects;
- output verifier and receipts based on database/provider results, not model claims;
- same-origin checks on cookie-authenticated mutations and callback path validation;
- secrets only in Sites/private Supabase configuration.

Remaining production work: validated SSR session-refresh Proxy; platform rate limiting/abuse quotas; CSP and full security-header review on the deployed host; secret rotation runbook; Cloudflare Workflow/Queue durability for long jobs; dedicated fresh-auth/MFA proof before any future tier-3 action; connector token envelope encryption and revocation tests; full two-user database test harness.

The user previously pasted provider/database credentials into chat. Those values are treated as compromised and must remain rotated; none are copied into this repository.
