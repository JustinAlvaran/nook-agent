# Testing strategy

Required on every focused release:

```bash
npm run lint
npm test
npm run build
```

The current suite checks state transitions, canonical hashes, approval binding, retries, queue idempotency, Stripe signatures, rendered product truth, the four-tool registry, signed execution calls, durable event schema, and callback hardening. Build validation covers every Vinext route.

Database integration coverage still needs a disposable Supabase branch with two JWT users. It must prove cross-user denial across every task child table, browser denial of authoritative lifecycle writes, invalid/expired signatures, concurrent double claim, duplicate finish, exact-once approval, persisted expiration, cancellation during run, retry exhaustion, changed arguments/version/hash, receipt truth, and preference re-read.

Browser QA must cover desktop and mobile widths, keyboard-only approval/task recovery, drag buttons, pause/hide/reset, reduced motion, WebGL fallback/context loss, OAuth return, refresh after every lifecycle state, offline/error copy, and no console errors. Agent evals should use fixed prompts for drafts, Facebook guidance, supported links, preferences, prompt injection, credential requests, unsupported effects, missing information, and model-understated risk.
