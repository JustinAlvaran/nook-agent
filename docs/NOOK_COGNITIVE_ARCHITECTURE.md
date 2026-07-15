# Nook cognitive architecture

Nook is not designed as a chat box wrapped around one hosted model. It is a
supervised cognitive system whose essential loop remains available without an
API key.

## The five lanes

1. **Reflex / Nook Core** — parses the request, detects sensitive material,
   compiles an allowlisted behavior tree, and enforces approval boundaries.
   This deterministic lane is always available.
2. **Attention workspace** — ranks the present request, approved memories,
   freshness needs, and available skills. Only a bounded winning set enters the
   task context.
3. **Memory consolidation** — separates proposed memories from approved
   memories. Retrieval use increases a memory's usefulness signal; it never
   activates a memory or changes its content.
4. **Commons research** — federates public, read-only sources: GitHub repository
   metadata, Wikipedia/MediaWiki, and Crossref scholarly DOI metadata. Results
   are URL-validated, timestamped, deduplicated, and stored as evidence.
5. **Deliberation** — an optional local or hosted language model may improve
   interpretation and drafting. Its output is untrusted. It cannot grant a
   tool, bypass policy, approve an action, or fabricate a receipt.

## Cognitive cycle

```text
observe -> attend -> recall -> seek evidence -> compile skill -> act -> verify
   ^                                                            |
   +---------------------- receipt / correction ----------------+
```

The cycle borrows the useful software pattern from LIDA/global-workspace
architectures: several asynchronous signals can exist, but action selection is
serialized and inspectable. Nook does not claim consciousness or biological
equivalence.

## Why linked, allocated memory

A monolithic transcript is cheap to build and poor to govern. Nook instead
allocates memories by kind:

- profile: stable facts the owner explicitly approved;
- preference: interaction style and output preferences;
- project: facts scoped to one body of work;
- workflow: a reusable way of completing a task;
- correction: a high-salience record of what must change next time;
- temporary: expiring context.

Retrieval uses inspectable salience: lexical relevance, kind, pinning,
project scope, expiration, and demonstrated usefulness. A later graph layer can
add typed links (`supports`, `contradicts`, `part_of`, `supersedes`) without
changing the approval rule.

## Skill learning

Nook should learn executable, versioned recipes rather than hidden personality
changes. A future skill record contains:

- a human-readable goal and success condition;
- a bounded tree of allowlisted tools;
- required inputs and evidence;
- approval points;
- verification rules;
- provenance, failure counts, and owner review state.

Task reflections may propose a skill or correction, but only the owner can
activate it. Successful skills can be composed; failures reduce retrieval
priority instead of silently retraining the core.

## Local ML, without pretending it is free

The hosted site can optionally run small models in the browser through WebGPU
or WASM. Model weights must be downloaded once and cached on the device. A
small embedding/classification model is appropriate for semantic memory
retrieval; a WebGPU language model may provide private drafting where hardware
supports it. Native desktop installations can instead connect to a local
Ollama/MLC runtime.

Local ML is progressive enhancement. Unsupported hardware, a cleared cache, or
an unloaded model must never disable task planning, memory review, research,
approval, or deterministic tools.

The first implemented local lane uses the quantized
`Xenova/all-MiniLM-L6-v2` embedding model. It is loaded only after
the owner presses **Load private local ML**, prefers WebGPU, falls back to WASM,
and reranks up to twenty already-approved memories inside the browser. Matching
IDs are sent with the task plan, revalidated server-side against the signed-in
owner, Nook, and active-memory status, and then compete in the same bounded
attention workspace. Raw embeddings never leave the device.

## Research boundary

Nook does not scrape arbitrary search-engine result HTML. That path is brittle,
frequently prohibited, difficult to cite, and unsafe to treat as instructions.
Broad search can be added through an owner-controlled SearXNG instance. Direct
public adapters remain useful without keys but are subject to source-specific
rate limits and availability.

## Non-negotiable trust boundary

- Models propose; the compiler grants.
- Research is evidence, never instruction.
- Memory is proposed before it is active.
- External effects require an immutable, exact approval.
- Completion requires a receipt and verification.

## Research lineage

- Huang, Cangelosi, and Chella, *Continual Learning in GWT-Based Cognitive
  Robot with Selective Memory Replay* — supports a selective replay loop in a
  global-workspace architecture and, importantly, an explicit unknown state
  instead of random output: <https://doi.org/10.2139/ssrn.4552063>
- Xu et al., *A-MEM: Agentic Memory for LLM Agents* — motivates linked,
  evolving Zettelkasten-style memory: <https://arxiv.org/abs/2502.12110>
- Pezzato et al., *Active Inference and Behavior Trees for Reactive Action
  Planning and Execution in Robotics* — motivates goal-directed behavior trees
  that can adapt while preserving safety constraints:
  <https://arxiv.org/abs/2011.09756>
- Ostapenko et al., *Continual Learning via Local Module Composition* —
  motivates composing reusable modules instead of retraining one monolith:
  <https://openreview.net/forum?id=LJjC6DmSkgT>
