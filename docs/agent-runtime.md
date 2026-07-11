# Nook agent runtime foundation

The website is the control plane. The agent graph proposes work; deterministic application code owns policy, approval, dispatch, and receipts. The checked-in Cloudflare Workflow uses the safe simulator until every production binding listed below exists.

## Runtime topology

1. An authenticated API creates an immutable task and a Workflow instance using the task ID.
2. `NookAgentWorkflow` coordinates named, retryable steps. It must not call an agent outside `step.do()`.
3. `OpenAIAgentsRuntime` builds the versioned manager graph. The manager may call at most the research, draft, and verify specialists. The only effect-shaped tool is approval-gated and simulated.
4. A production approval endpoint stores an immutable approval decision before sending an `approval-resume` event to the Workflow.
5. Approved connector work enters a Queue. The consumer deduplicates on `actionId`, reconciles uncertain outcomes, commits the receipt, and only then notifies the Workflow.
6. Supabase/Postgres is the canonical audit store. Workflow state is not the long-term record; use R2 for a serialized `RunState` if it approaches the Workflow result-size limit.

## Invariants

- Recompute risk in `evaluateActionPolicy`; model-assigned risk can only raise, never lower, the floor.
- Approval binds to the SHA-256 hash of the full canonical `ActionEnvelope`. Changed arguments require a new approval.
- Risk 2 requires an exact preview and approval. Risk 3 additionally requires fresh authentication.
- A connector receives no action until the approval hash and authenticated owner match.
- Queue delivery is at least once. The provider and database use the same stable idempotency key.
- An uncertain provider timeout is reconciled before retrying.
- A task is complete only after every effect has a successful or explicitly simulated receipt.
- Never put credentials, provider tokens, cookies, or payment data in model context, `RunContext`, serialized `RunState`, logs, events, or receipts.

## Required production integration

- Install `@openai/agents` and Zod 4; enable Cloudflare `nodejs_compat`.
- Bind an `OPENAI_API_KEY` secret and choose the approved model through environment configuration.
- Add Postgres tables for versioned plans/steps, approval intents/decisions, checkpoints, work items, attempts, receipts, and append-only events with RLS.
- Implement a checkpoint store that records graph, prompt, and SDK versions plus the state hash. Keep the old graph/SDK available while approvals remain pending.
- Implement the approval API with CSRF protection, server-derived ownership, expiry checks, tier-3 reauthentication, compare-and-set status changes, and action-hash verification.
- Bind a Workflow, execution Queue, and DLQ. Set Queue `max_retries`; alert and provide manual review for DLQ messages.
- Replace the Workflow simulator only after the checkpoint and approval adapters exist. Do not silently fall back from a failed live run to a simulated success.
- Configure Agents SDK trace flushing at the end of every Worker/Workflow invocation and also persist explicit task/action/attempt IDs because Cloudflare `AsyncLocalStorage` trace nesting can be incomplete.
- Use the default HTTP Responses transport. Do not use the Responses WebSocket transport in Workers.

The Workflow simulator is deliberately honest: even after an approval event it reports that live execution is not installed and performs no external effect.
