# Learning and memory

Nook does not learn continuously. It may use only active, user-owned memories. Model-generated candidates must remain proposals until the owner approves them; rejected, expired, deleted, and proposed records are not retrieval candidates.

## Implemented

- Direct teaching, correction, and archival are owner-scoped.
- Secret-like content, authentication data, private keys, cookies, and payment-card patterns are rejected before persistence.
- Retrieval helpers exclude inactive and expired records.
- Task-generated suggestions require an explicit user action in the dashboard.

## Partially implemented

The current production schema has active/archived memories. A new migration for proposal statuses, memory-use audit, expanded categories, and suggestion-category suppression is pending because the Supabase CLI could not be bootstrapped in this environment. Those features must not be described as deployed.

## Privacy

Memories belong to an owner and Nook. Marketplace transfers never include memories. Memories cannot grant tools, permissions, approvals, or policy exceptions.
