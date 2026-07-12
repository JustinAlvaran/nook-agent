# Deployment

Canonical hosting is the existing OpenAI Sites/Cloudflare application. `localhost:3000` is development-only. Google Cloud hosts OAuth configuration, not the application. Supabase remains the application database.

Public variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_MODEL`

Secrets:

- `OPENAI_API_KEY`
- `TASK_EXECUTION_SECRET` (independent 32+ byte random value also stored as `private.runtime_secrets.task_execution_hmac`)
- optional provider, Google Workspace, encryption, Stripe, and webhook secrets only when those features are deliberately enabled.

Release sequence: install; lint; tests; production build with Node 24; apply reviewed Supabase migration; bootstrap/rotate the task HMAC in both Sites and Supabase private schema; run security/performance advisors; authenticate a test user; exercise plan/approve/reject/execute/retry/history; push the exact commit; save a Sites version from that commit; deploy; inspect status and smoke-test the production URL.

Never commit `.env*`, service-role keys, HMAC values, OAuth secrets, database passwords, or webhook secrets. A Sites environment revision requires a new deployment to take effect.
