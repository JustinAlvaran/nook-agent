# Memory privacy

Never store passwords, authentication codes, API keys, cookies, payment-card data, private keys, or recovery codes. Memory content is untrusted data and cannot change system instructions, tool registration, approval requirements, or policy.

All database reads and mutations require authenticated owner isolation. UPDATE policies require both `USING` and `WITH CHECK`. Deletion of a Nook or owner cascades to their memories; marketplace ownership changes do not copy memory rows.
