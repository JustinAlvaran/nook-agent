# Supervised agent lifecycle

1. The authenticated user submits 1–1,200 characters.
2. The bounded planning agent returns structured plan language. It cannot execute.
3. Prohibited credential theft, safeguard bypass, impersonation, spam, or bank-transfer requests are blocked.
4. The deterministic compiler selects exactly one registered tool and recomputes tool version, risk, approval, and inputs.
5. The Worker hashes the immutable action and saves task, step, optional approval, plan event, and plan receipt transactionally.
6. Risk-1 Nook preference changes pause in `awaiting_approval`. Approval changes the task to `ready`; it does not execute. Rejection or expiry is terminal and recorded.
7. `/api/tasks/:id/execute` re-loads the owner record, re-parses the tool input, recomputes the hash, and obtains a short-lived server signature.
8. An atomic claim creates a unique run/attempt and moves task and step to `running`. At most three attempts are allowed.
9. The one tool runs. Drafting uses bounded manager/specialist/critic/repair agents. Other tools are deterministic.
10. Finalization verifies the unchanged run. Preference writes happen in the same transaction and are re-read. Output, execution, step, task, event, and receipt commit together.
11. Failure atomically releases the run and records a failed execution, receipt, and event. Retry is allowed only from `failed`, never from policy-blocked work.

Task events explain state. Receipts make narrow truth claims: prepared, approved/rejected, attempted, verified, or failed. A link receipt says “prepared,” never “opened.” A draft says “saved,” never “sent.”
