const VERSION = "nook-browser-command@1";
const DEFAULT_API = "https://nook-desktop-pet.cookiewapo3.chatgpt.site";
const ALLOWED_APIS = new Set([
  DEFAULT_API,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const PROVIDERS = Object.freeze({
  youtube: {
    home: "https://www.youtube.com/",
    search: "https://www.youtube.com/results?search_query=",
  },
  google: {
    home: "https://www.google.com/",
    search: "https://www.google.com/search?q=",
  },
  bing: {
    home: "https://www.bing.com/",
    search: "https://www.bing.com/search?q=",
  },
  wikipedia: {
    home: "https://en.wikipedia.org/",
    search: "https://en.wikipedia.org/w/index.php?search=",
  },
  github: {
    home: "https://github.com/",
    search: "https://github.com/search?type=repositories&q=",
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function base64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)).buffer;
}

function expectedUrl(action) {
  const provider = PROVIDERS[action?.provider];
  if (!provider || action?.disposition !== "new_tab") return null;
  if (action.action === "open_provider") return provider.home;
  if (
    action.action === "search_provider" &&
    typeof action.query === "string" &&
    action.query.length > 0 &&
    action.query.length <= 300
  )
    return `${provider.search}${encodeURIComponent(action.query)}`;
  return null;
}

function validateCommand(command) {
  if (
    command?.version !== VERSION ||
    typeof command.id !== "string" ||
    typeof command.taskId !== "string" ||
    !/^[0-9a-f]{32,128}$/i.test(command.actionHash || "") ||
    !Number.isFinite(Date.parse(command.expiresAt)) ||
    Date.parse(command.expiresAt) <= Date.now()
  )
    throw new Error("Command envelope is invalid or expired.");
  const url = expectedUrl(command.action);
  if (!url || command.action.url !== url)
    throw new Error("Command URL is outside the packaged provider allowlist.");
  return url;
}

async function signReceipt(receiptJson, privateJwk) {
  const key = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(receiptJson),
  );
  return base64Url(signature);
}

async function api(path, options = {}) {
  const state = await chrome.storage.local.get(["apiOrigin", "deviceToken"]);
  const origin = ALLOWED_APIS.has(state.apiOrigin) ? state.apiOrigin : DEFAULT_API;
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (state.deviceToken) headers.authorization = `Bearer ${state.deviceToken}`;
  const response = await fetch(`${origin}${path}`, { ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Nook API returned ${response.status}.`);
  return result;
}

async function execute(command) {
  let status = "failed";
  let openedTabId = null;
  let openedUrl = null;
  let error = null;
  try {
    const url = validateCommand(command);
    const tab = await chrome.tabs.create({ url, active: true });
    status = "succeeded";
    openedTabId = Number.isInteger(tab.id) ? tab.id : null;
    openedUrl = url;
  } catch (caught) {
    error = caught instanceof Error ? caught.message.slice(0, 300) : "Browser action failed.";
  }
  const receipt = {
    commandId: command?.id || "00000000-0000-0000-0000-000000000000",
    actionHash: command?.actionHash || "0".repeat(64),
    status,
    openedTabId,
    openedUrl,
    completedAt: new Date().toISOString(),
    error,
  };
  const { privateJwk } = await chrome.storage.local.get("privateJwk");
  if (!privateJwk) throw new Error("Browser Hand signing key is missing.");
  const receiptJson = JSON.stringify(receipt);
  const signature = await signReceipt(receiptJson, privateJwk);
  await chrome.storage.local.set({
    pendingCompletion: { receiptJson, signature },
    lastReceipt: receipt,
    lastError: error,
    lastSeenAt: new Date().toISOString(),
  });
  await flushPendingCompletion();
}

async function flushPendingCompletion() {
  const { pendingCompletion } = await chrome.storage.local.get("pendingCompletion");
  if (!pendingCompletion) return;
  await api("/api/browser/commands/complete", {
    method: "POST",
    body: JSON.stringify(pendingCompletion),
  });
  await chrome.storage.local.remove("pendingCompletion");
}

let polling = false;
async function pollWindow(iterations = 20) {
  if (polling) return;
  polling = true;
  try {
    for (let index = 0; index < iterations; index += 1) {
      const state = await chrome.storage.local.get(["deviceToken", "enabled"]);
      if (!state.deviceToken || state.enabled === false) return;
      try {
        await flushPendingCompletion();
        const result = await api("/api/browser/commands/claim", {
          method: "POST",
          body: "{}",
        });
        await chrome.storage.local.set({
          lastSeenAt: new Date().toISOString(),
          lastError: null,
        });
        if (result.command) await execute(result.command);
        await sleep(Math.max(750, Math.min(Number(result.retryAfterMs) || 1500, 5000)));
      } catch (error) {
        await chrome.storage.local.set({
          lastError: error instanceof Error ? error.message : "Connection failed.",
        });
        await sleep(3000);
      }
    }
  } finally {
    polling = false;
  }
}

async function createIdentity() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const [privateJwk, publicSpki] = await Promise.all([
    crypto.subtle.exportKey("jwk", pair.privateKey),
    crypto.subtle.exportKey("spki", pair.publicKey),
  ]);
  return { privateJwk, publicKey: base64Url(publicSpki) };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "status") {
    chrome.storage.local.get(null).then((state) => sendResponse({ ok: true, state }));
    return true;
  }
  if (message?.type === "pair") {
    (async () => {
      const apiOrigin = ALLOWED_APIS.has(message.apiOrigin) ? message.apiOrigin : DEFAULT_API;
      const identity = await createIdentity();
      await chrome.storage.local.set({ ...identity, apiOrigin });
      const result = await api("/api/browser/pairings/redeem", {
        method: "POST",
        body: JSON.stringify({
          code: String(message.code || "").trim().toUpperCase(),
          deviceName: `Nook Browser Hand · ${navigator.platform || "browser"}`,
          publicKey: identity.publicKey,
        }),
      });
      await chrome.storage.local.set({
        deviceId: result.deviceId,
        deviceToken: result.deviceToken,
        enabled: true,
        pairedAt: new Date().toISOString(),
      });
      void pollWindow();
      return { deviceId: result.deviceId };
    })()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "disconnect") {
    chrome.storage.local.clear().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "wake") {
    void pollWindow();
    sendResponse({ ok: true });
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("nook-browser-poll", { periodInMinutes: 0.5 });
  void pollWindow();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("nook-browser-poll", { periodInMinutes: 0.5 });
  void pollWindow();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "nook-browser-poll") void pollWindow();
});

// Kept for migration compatibility if an earlier build stored binary key data.
void fromBase64Url;
