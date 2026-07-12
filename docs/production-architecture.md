# Nook production blueprint (historical)

> This blueprint predates the Supabase supervised-agent implementation. For current runtime truth use `architecture.md`, `agent-lifecycle.md`, and `tool-registry.md`. Supabase/Postgres is authoritative and D1 is disabled.

This document separates the polished web product from the components required to make Nook a real desktop agent. A hosted website cannot walk across native applications or reuse a person's logged-in browser session by itself.

## Product surfaces

1. **Nook Web** — identity, owned Nooks, wardrobe, skills, marketplace, tasks, approvals, receipts, billing, and creator tools. This repository is the web control plane.
2. **Nook Agent Runtime** — durable task plans, policy checks, integrations, approval pauses, receipts, quotas, and model-provider calls.
3. **Nook Desktop** — a separately installed and signed Tauri 2 app. It owns the transparent always-on-top mascot window, local device pairing, screen-wide movement, and narrowly granted OS capabilities.
4. **Nook Browser Extension** — optional Manifest V3 extension using `activeTab` and optional per-site permissions. It communicates only with the signed desktop host.

## Recommended stack

| Concern | Recommendation |
| --- | --- |
| Web | Keep Vinext, React, TypeScript, Cloudflare Workers/Sites |
| Database | Drizzle + D1 for profiles, Nooks, tasks, receipts, listings, and licenses |
| Identity | Better Auth with D1/Drizzle; separate Google/GitHub login from later provider-access consent |
| OAuth security | Encrypt provider tokens; no implicit same-email linking; exact callbacks; separate dev/staging/prod apps |
| Assets | R2 for GLB models, clothing, thumbnails, screenshots, and exports |
| Long tasks | Cloudflare Workflows for pauses and human approval |
| Async work | Queues with idempotent consumers and a dead-letter queue |
| Live state | One Durable Object per active Nook, canonical records in D1 |
| Browser work | Official provider APIs first; Browser Run only for isolated ephemeral sessions |
| Desktop | Tauri 2 with restrictive capability files, signed installers, and signed updates |
| Payments | Stripe Checkout + Connect onboarding + signed idempotent webhooks |
| 3D | Custom Blender rig → optimized GLB → React Three Fiber → DOM controls + CSS fallback |

## Identity boundary

Google and GitHub sign-in require owner-created OAuth applications, exact production callback URLs, client IDs, and secrets. A GitHub account connected to Codex does not automatically authorize this website as a GitHub OAuth application.

Until those credentials exist, the live Sites build uses ChatGPT sign-in for the working private preview and presents Google/GitHub as an integration-ready onboarding design. Never simulate a successful provider login.

When provider credentials are available:

1. Add Better Auth and its official Drizzle SQLite adapter.
2. Generate `user`, `session`, `account`, and `verification` migrations.
3. Store secrets in the hosting environment, never in Git or `.env.example` values.
4. Use identity-only scopes on login.
5. Add a separate Connections screen for task-related Google/GitHub scopes.
6. Require fresh authentication before linking/unlinking providers or changing payout/security settings.

## Agent execution contract

```text
request
  → immutable task record
  → planner returns strict TaskPlan JSON
  → policy engine assigns risk and approval requirements
  → workflow starts
  → API adapter / isolated browser / paired desktop runtime
  → preview before external effect
  → explicit user approval
  → idempotent execution
  → append-only action receipt
  → Nook animation and speech event
```

The model proposes steps. Application code authorizes and performs them.

### Risk tiers

- **Tier 0:** explain, search, summarize, draft — automatic.
- **Tier 1:** reversible internal changes — automatic only after the user enables the skill.
- **Tier 2:** messages, posts, file writes, form submission, account changes — always preview and confirm.
- **Tier 3:** purchases, deletion, publishing, permissions, identity-sensitive actions — fresh reauthentication and confirmation.
- **Blocked:** credential harvesting, CAPTCHA bypass, spam, fake-account creation, banking transfers, or arbitrary local shell execution.

For Facebook, use guided setup or an approved Meta Pages API integration. Do not automate personal registration. The user types passwords directly on Meta's page; Nook never reads or stores them.

## Data domains

The current migration establishes production-oriented domain tables for profiles, Nooks, immutable appearance versions, tasks, task events, skills, installations, and wearables. Add these groups in later phases:

- Better Auth identity tables and sessions.
- Devices, public keys, pairings, revocations, and last-seen data.
- Integration connections with encrypted tokens and exact scopes.
- Versioned task plans, steps, approvals, and append-only receipts.
- Assets with R2 keys, hashes, MIME, byte size, quarantine and moderation states.
- Creator profiles, listings and immutable listing versions.
- Orders, licenses, refunds, Stripe webhook events, and a local ledger projection.
- Memories with provenance, sensitivity, expiry, edit/forget controls, and source links.

Every user-owned query must authorize with the server-derived user ID. Never accept ownership from a client-supplied Nook ID alone.

## Creator and asset safety

Marketplace packages are assets and declarative manifests only. Never run creator JavaScript, WASM, binaries, shell commands, or native plugins.

Upload flow:

1. Issue a short-lived presigned upload URL.
2. Place bytes in a quarantine prefix.
3. Validate GLB structure, file type, byte size, triangle/bone counts, texture dimensions, clip names, sockets, and external URI use.
4. Re-encode to a canonical format in an isolated processing job.
5. Scan and moderate metadata and imagery.
6. Publish by content hash with an immutable version.
7. Generate WebP marketplace previews so listing grids do not mount many WebGL canvases.

## Security checklist

- Treat every webpage, email, document, and marketplace description as untrusted input.
- Never put OAuth tokens, cookies, passwords, payment data, or recovery codes into model context or logs.
- Re-check authorization at every API and task step.
- Block private, loopback, link-local, and metadata endpoints in any URL fetcher; revalidate redirects.
- Use idempotency keys for task steps, queues, payments, and webhooks.
- Enforce daily spend, step, token, browser-minute, concurrency, and wall-time limits.
- Add a global agent-action kill switch.
- Keep screenshots off by default, short-lived, redacted, and user deletable.
- Add account export/delete, memory review/forget, device/session revocation, and clear retention periods.
- Require CSP, secure cookies, CSRF protection, Turnstile on abusive flows, dependency scanning, restore drills, and an incident runbook.

## Rollout plan

### Phase 0 — honest prototype

- Label task effects as simulated.
- Freeze action taxonomy, risk tiers, receipt shape, mascot rig, and privacy defaults.
- Add CI, migration checks, environments, secret inventory, and accessibility tests.

### Phase 1 — identity and owned Nooks

- Google/GitHub auth after credentials are provided.
- Profile, onboarding, one user-owned Nook, appearance history, closet, export/delete.
- R2 asset pipeline. No external task execution.

### Phase 2 — task simulator

- Persist task plans, steps, approvals, and receipts.
- Declarative skills, budgets, cancellation, and mascot events.
- Build the evaluation suite before enabling writes.

### Phase 3 — isolated browser beta

- Invited users; allowlisted public/read-only sites; ephemeral Browser Run sessions.
- Confirmation before submissions, human takeover, and review of every failure.

### Phase 4 — desktop alpha

- Windows-first Tauri app with transparent mascot window and signed device pairing.
- Read-only local actions first; optional browser extension with runtime-granted access.
- Signed installers/updates, device revocation, crash reporting, and emergency disable.

### Phase 5 — marketplace beta

- Creator onboarding, asset validation, human moderation, licenses, purchases, refunds, reviews, and reports.
- Stripe Connect test mode before limited live sellers.
- Decide merchant-of-record, tax, refunds, disputes, and seller eligibility with counsel.

### Phase 6 — production gate

- External penetration test and agent red team.
- Privacy/legal review, support and abuse operations, restore/reconciliation drills.
- Canary rollout with automatic rollback on confirmation bypass, unusual spend, or safety regressions.

## Owner inputs still required

- Google Cloud OAuth application and secret.
- GitHub OAuth application and secret.
- Stripe business/Connect onboarding and webhook secret.
- Model provider key, billing, retention decision, and budget.
- Meta developer app and approved Page scopes if Facebook publishing is included.
- Code-signing certificates for Nook Desktop.
- Licensed rigged mascot source and final animation set.
- Chosen GitHub repository or organization and branch policy.

## Primary references

- [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- [Cloudflare Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth Google provider](https://better-auth.com/docs/authentication/google)
- [Stripe Connect marketplace guide](https://docs.stripe.com/connect/marketplace)
- [Tauri capabilities](https://v2.tauri.app/security/capabilities/)
- [Chrome extension permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [OpenAI computer-use safety approach](https://openai.com/index/computer-using-agent/)
