# Authentication and ownership

Nook application identity is Supabase Auth's immutable user UUID. Google and GitHub are login providers only. Connector consent is a separate future relationship.

Protected server code calls `supabase.auth.getUser()` and derives `owner_id` from that verified identity. Display names and avatars may use user metadata, but authorization never does. Email is not an ownership key. “Continue with ChatGPT” was removed because Sites identity headers did not establish a Supabase session and would have created two incompatible identity systems.

OAuth callback destinations pass through `safeAppPath()`, which accepts only `/dashboard`, a known dashboard section, or `/create`; it rejects backslashes, protocol-relative values, controls, and off-origin URLs. Sign-out is POST-only. Cookie-authenticated mutation routes reject cross-site browser requests using `Origin` and Fetch Metadata.

Known limitation: the current Vinext deployment has no validated Next.js Proxy session-refresh layer. Route protection still uses the fresh `getUser()` network check. Add and test a Vinext-compatible Proxy before claiming seamless long-lived refresh behavior.
