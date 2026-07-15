# Browser Hand capability boundary

## Decision

Nook controls browser tabs through a paired Manifest V3 extension, not through page links pretending to be automation and not through a cloud browser holding the user's session.

The first production capability is deliberately narrow:

1. The deterministic task compiler recognizes a bounded grammar such as `open YouTube and search for ambient music`.
2. Nook saves the exact provider, query, tool version, action hash, and task/run relationship.
3. A paired browser device claims the short-lived command with a revocable bearer token.
4. The packaged extension independently recomputes the expected provider URL. It opens a new tab only when the command and URL agree.
5. The extension signs a receipt with its per-install P-256 private key. The server verifies that signature before marking the task complete.

## Why this boundary

Opening or navigating a tab does not require Chrome's broad `tabs` permission. The extension therefore requests only `storage`, `alarms`, and host access to the Nook control-room API. It has no access to cookies, history, passwords, arbitrary site contents, all URLs, the debugger protocol, or remote executable code.

This also keeps the Nook brain provider-independent. A model may help phrase a plan, but only the deterministic compiler can grant `browser_tab`, and the extension rejects anything outside its packaged action grammar.

## Failure semantics

- Offline companion: the task remains ready and tells the user to pair or wake Browser Hand.
- Command rejected: the device returns a signed failed receipt and the task fails without claiming success.
- Receipt timeout: the command expires, the task records an uncertain failure, and late completion is rejected.
- Duplicate completion: the same device-signed receipt is idempotent.

## Next capabilities

Page interaction should be added as site adapters, not as arbitrary selectors or remote JavaScript. Each adapter must define its own input schema, verification rule, and permission scope. A future active-tab lane may use a direct user gesture plus Chrome's temporary `activeTab` permission for one-page assistance. Persistent host access should remain optional and domain-specific.

