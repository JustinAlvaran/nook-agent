# Nook

Nook is a character-led supervised agent control room. The usable MVP turns a signed-in user's request into a structured plan, authorizes only one versioned allowlisted tool, pauses for an exact approval when required, executes, verifies, and stores a durable timeline and receipt. The mascot reflects those real states.

What works now:

- Supabase Google/GitHub identity and owner-scoped Nooks, plans, approvals, outputs, memories, events, executions, and receipts.
- A keyless semantic reflex that retrieves a known ability, checks required details, and shows the user what Nook understood before planning.
- Optional private local RAG with Transformers.js and MiniLM. It ranks Nook's versioned ability cards and only already-approved user memories in the browser using WebGPU with a WASM fallback; request text, memory text, and embeddings are not sent to a model provider.
- Eight versioned tools: `create_draft`, `guided_workflow`, `open_supported_url`, `save_nook_preference`, `search_web`, `summarize_sources`, `propose_memory`, and `browser_tab`.
- Allowlisted browser quick-open for YouTube, Google, Bing, Wikipedia, and GitHub, including common aliases and minor typos. Provider URLs and search arguments are still compiled deterministically from the original request.
- Keyless local planning and drafting remain available without an API key. When configured by the operator, the bounded OpenAI Agents SDK may improve planning and draft/critic/repair wording but cannot grant tools or permissions.
- Deterministic tool schemas, risk, approval requirements, action hashes, server signatures, retry limits, and truthful receipts.
- Procedural WebGL Nook customization with server-first account recovery, drag alternatives, pause motion, hide, and reset.

The semantic layer is intentionally not a hidden autonomous LLM. Retrieval supplies context; the server-side registry remains the authority. Missing providers, missing queries, ambiguous references, and unsupported follow-up actions produce a clarification instead of silently becoming a different tool.

Not implemented: unrestricted browser/desktop control, arbitrary page clicking or reading, Facebook account registration, connector writes, paid commerce, creator uploads, or a production rigged GLB mascot. Those surfaces are labelled preview or coming later.

## Run locally

Use Node.js 24 (Node 22.13+ is the minimum required by the current build stack):

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

Required public configuration is documented in [`docs/deployment.md`](docs/deployment.md). Secrets stay in the hosting platform, never `.env` files committed to Git. Supabase/Postgres is the sole application database; `.openai/hosting.json` intentionally has D1 disabled.

## Read next

- [`docs/architecture.md`](docs/architecture.md) — current system and trust boundaries.
- [`docs/agent-lifecycle.md`](docs/agent-lifecycle.md) — exact plan/approval/execute/verify lifecycle.
- [`docs/tool-registry.md`](docs/tool-registry.md) — allowlist and extension checklist.
- [`docs/security-model.md`](docs/security-model.md) — threat controls and remaining risks.
- [`docs/mvp-scope.md`](docs/mvp-scope.md) — product truth and explicit exclusions.
- [`docs/mascot-production-brief.md`](docs/mascot-production-brief.md) — original rigged-asset contract for the next mascot stage.
- [`docs/research-log.md`](docs/research-log.md) — official sources and decisions.

The older `docs/production-architecture.md` is retained as historical context only; where it conflicts with the documents above, the current Supabase supervised-MVP architecture wins.
