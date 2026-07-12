# Tool registry

The frozen registry is in `lib/agent/tools/registry.ts`. Each entry owns its strict Zod schema, version, risk, effect flag, reversibility, approval rule, permission label, execution behavior, and verification rule.

| Tool | Input | Risk | Approval | Verified claim |
|---|---|---:|---|---|
| `create_draft@1` | bounded artifact type, title, instructions | 0 | no | content passed bounded critic/repair and was saved |
| `guided_workflow@1` | `facebook_page_setup`, bounded request | 0 | no | static checklist prepared; nothing submitted |
| `open_supported_url@1` | enum destination only | 0 | no | fixed HTTPS link prepared for user click |
| `save_nook_preference@1` | one field-specific enum | 1 | yes | exact setting changed and re-read transactionally |

Unknown names, versions, extra properties, invalid enums, or changed post-approval arguments fail closed. No arbitrary URL, fetch, shell, filesystem, browser-control, connector-write, purchase, or publish tool exists.

To add a tool: define the smallest strict schema; classify data/effect/reversibility/cost; specify approval and fresh-auth requirements; create canonical preview copy; implement idempotency and deterministic verification; add database constraints; add malicious-input, changed-argument, replay, cross-user, retry, and receipt-truth tests; update this table; ship disabled until those tests pass.
