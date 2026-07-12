# Research log

Access date for every entry: 2026-07-12. Official/primary sources were preferred. “Implemented” means code or a current contract changed in this branch; “considered” means the decision is documented but not claimed as shipped.

| Source | Finding | Decision | Status |
|---|---|---|---|
| https://openai.github.io/openai-agents-js/guides/running-agents/ | Structured output and bounded runs support typed planning. | Keep Agents SDK planner/manager with explicit turn limits. | Implemented |
| https://openai.github.io/openai-agents-js/guides/tools/ | Zod tool inputs are strict by default; tool code is the effect boundary. | Frozen four-tool registry; model labels never authorize. | Implemented |
| https://openai.github.io/openai-agents-js/guides/human-in-the-loop/ | Approval should interrupt before the exact call and resume unchanged state. | Hash-bound approval changes task to ready; executor revalidates arguments. Serialized RunState remains for later durable Workflows. | Partial/considered |
| https://openai.github.io/openai-agents-js/guides/guardrails/ | Untrusted content needs input/tool guardrails. | Block credential/safeguard abuse and treat supplied content as data. | Implemented |
| https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs | Server components need careful cookie refresh; use verified claims/users, not untrusted session data. | Continue `getUser()` protection; document Vinext Proxy gap. | Implemented/remaining |
| https://supabase.com/docs/guides/auth/social-login/auth-google | OAuth callback is the Supabase URL; application return URLs need allowlisting. | Keep Supabase callback; validate internal return path. | Implemented |
| https://supabase.com/docs/guides/auth/social-login/auth-github | GitHub login follows the same server callback model. | One Supabase identity model for both providers. | Implemented |
| https://supabase.com/docs/guides/auth/auth-identity-linking | Linked identities require explicit account semantics. | No email-based Sites/Supabase bridge. | Implemented |
| https://supabase.com/docs/guides/database/postgres/row-level-security | Privileges and RLS both apply; definer functions can bypass RLS. | Revoke authoritative browser writes; validate owner in signed functions. | Implemented |
| https://supabase.com/docs/guides/database/functions | Prefer invoker; definer needs empty search path and explicit EXECUTE grants. | Empty search paths, narrow grants, server signatures. | Implemented |
| https://supabase.com/docs/guides/api/securing-your-api | Exposed functions depend on EXECUTE privileges. | Old forgeable lifecycle RPC execution revoked. | Implemented |
| https://www.postgresql.org/docs/current/ddl-rowsecurity.html | RLS is default-deny only when policies/privileges are correctly combined. | Owner SELECT policies plus closed mutation surface. | Implemented |
| https://developers.cloudflare.com/workers/configuration/environment-variables/ | Secrets and environment values belong in Worker bindings, not source. | Sites secrets for OpenAI/task HMAC. | Implemented |
| https://developers.cloudflare.com/workers/vite-plugin/reference/secrets/ | Local and deployed secret handling differ. | Document environment bootstrap and never commit values. | Implemented |
| https://developers.cloudflare.com/workflows/ | Workflows provide durable long-running coordination. | Use later for connectors/approval pauses; do not falsely claim active MVP durability. | Considered |
| https://developers.cloudflare.com/workflows/build/rules-of-workflows/ | Workflow steps retry; effects require idempotency. | Action hashes/attempt uniqueness now; Queue/Workflow expansion later. | Partial |
| https://github.com/cloudflare/vinext | Vinext is experimental and current stack targets Next 16/Vite 8. | Keep current host and validate every release; record Node 24 requirement/tooling warning. | Implemented |
| https://nextjs.org/docs/app/api-reference/functions/cookies | Cookie writes belong in route handlers/server functions. | Keep SSR cookie adapter and route-based OAuth exchange. | Implemented |
| https://r3f.docs.pmnd.rs/api/canvas | Canvas supports fallback and renderer lifecycle hooks. | Add fallback plus context-loss fallback. | Implemented |
| https://r3f.docs.pmnd.rs/advanced/scaling-performance | Demand loops, reuse, and offscreen reduction matter for multiple canvases. | Keep one meaningful Nook in control room; homepage canvas reduction remains. | Partial |
| https://threejs.org/docs/pages/GLTFLoader.html | GLB loading needs validated glTF assets and optional compression setup. | Original GLB pipeline contract, not stock replacement. | Considered |
| https://threejs.org/docs/pages/AnimationMixer.html | Named clips and crossfades support durable-state motion. | Required production animation manifest. | Considered |
| https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html | glTF 2.0 defines portable scene/skin/animation rules. | `.glb` production delivery and rig compatibility version. | Considered |
| https://github.khronos.org/glTF-Validator/ | Validator catches structural/accessor issues. | Mandatory asset release gate. | Considered |
| https://docs.blender.org/manual/en/3.3/addons/import_export/scene_gltf2.html | Blender exporter settings affect transforms, materials, skins, and clips. | Applied transforms and export inspection in mascot brief. | Considered |
| https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html | Continuous movement needs pause/stop/hide. | Add Pause motion and Hide Nook controls. | Implemented |
| https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html | Drag functionality needs a non-drag alternative. | Direction buttons and Reset in addition to keyboard arrows. | Implemented |
| https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html | Motion triggered by interaction must respect user control. | Reduced-motion and manual pause stop procedural loops. | Implemented |

No third-party visual asset was downloaded or purchased. Competitive sources and conclusions are listed in `competitive-ux-research.md`.
