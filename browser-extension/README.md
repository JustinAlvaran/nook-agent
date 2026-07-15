# Nook Browser Hand

This Manifest V3 extension is the least-privilege browser actuator for Nook. Version 0.1 supports one capability: open an allowlisted provider homepage or compiled search URL in a new tab.

It deliberately has no `tabs`, `history`, `cookies`, `webRequest`, `scripting`, `<all_urls>`, or debugger permission. Commands are data, never JavaScript. The extension recomputes the expected URL from its packaged provider registry before opening it, and signs the completion receipt with a per-install P-256 key.

## Local install

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select this `browser-extension` folder.
4. In Nook, open **Connectors → Browser Hand** and create a one-time code.
5. Open the extension popup, enter the code, and pair.

The production API origin is fixed in the package. Local development may use `http://localhost:3000`. Pairing tokens and the private signing key stay in `chrome.storage.local`.

