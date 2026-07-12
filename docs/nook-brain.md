# Nook brain

## Implemented

Nook separates deterministic perception, bounded context assembly, research decisions, model-proposed planning, deterministic tool compilation, policy enforcement, approval, execution, verification, and safe operational reflection. `lib/agent/brain.ts` owns the non-executing cognition contracts. Perception and context assembly never execute tools or grant permissions.

Context is bounded to eight relevant memories, five recent task summaries, twelve registered tools, and eight explicit constraints/providers. Expired and cross-project memories are excluded. Confidence is descriptive only and is never a security control.

## Partially implemented

The existing planner is model-backed, then compiled through the allowlisted tool registry. Clarification and research decisions now have deterministic contracts, but task persistence and the dashboard flow will be connected in later phases.

## Not implemented yet

Research execution, sequential research-to-draft plans, persisted reflection, and memory proposals are later reviewable phases.
