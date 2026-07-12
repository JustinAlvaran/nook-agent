# Database and lifecycle invariants

Supabase/Postgres is authoritative. Current MVP tables are profiles, nooks, immutable appearance versions, tasks, task steps, approvals, task executions, task events, task outputs, action receipts, and user-approved memories. Marketplace/device/connector foundation tables remain separate and do not authorize agent execution.

Browser roles have owner SELECT through explicit grants and RLS. Authoritative lifecycle inserts are revoked. Signed `SECURITY DEFINER` functions have empty `search_path`, validate `auth.uid()`, verify a short-lived server signature, lock rows, and perform compare-and-set transitions. User decision functions are self-scoped and cannot create output or success receipts.

Invariants:

- one output per task;
- one current step in the MVP;
- tool name/version/input are all present or all null;
- action hash is immutable and revalidated before execution;
- unique action-hash/attempt, maximum three attempts;
- one pending approval per step;
- approved means ready, not completed;
- failure/cancel clear active run state;
- events and receipts are append-only to browser clients;
- memories are filtered by both owner and the task's Nook.

Lifecycle history and immutable appearance/product snapshots should be retained. User-authored memories may be archived/deleted. Deleting an account cascades owner data; financial/security retention rules must be finalized before live payments.
