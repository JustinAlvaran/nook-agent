# Decision: one application identity

Status: accepted for MVP.

Supabase Auth UUID is the sole application principal. Google/GitHub identities may link through Supabase. Sites/ChatGPT identity headers are not mapped by email and are not presented as a login method. This avoids split ownership, silent account collision, and unrecoverable cross-provider data.

Revisit only with a verifiable first-party assertion exchange, immutable provider subject mapping, explicit link/unlink/recovery UX, session migration plan, and cross-account tests.
