import { getServerEnvironment } from "../env";

export type GoogleWorkspaceCapability = "read" | "draft" | "calendar-write" | "send";

const capabilityScopes: Record<GoogleWorkspaceCapability, string[]> = {
  read: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar.freebusy",
  ],
  draft: [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/gmail.compose",
  ],
  "calendar-write": ["https://www.googleapis.com/auth/calendar.events"],
  send: ["https://www.googleapis.com/auth/gmail.send"],
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function connectorEncryptionKey() {
  const env = getServerEnvironment();
  if (!env.CONNECTOR_TOKEN_ENCRYPTION_KEY) throw new Error("Connector encryption is not configured.");
  const keyBytes = fromBase64Url(env.CONNECTOR_TOKEN_ENCRYPTION_KEY);
  if (keyBytes.byteLength !== 32) throw new Error("Connector encryption key must decode to 32 bytes.");
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function createOAuthNonce(size = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function createPkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function getGoogleScopes(capability: GoogleWorkspaceCapability) {
  const ordered = [...capabilityScopes.read];
  if (capability !== "read") ordered.push(...capabilityScopes[capability]);
  return [...new Set(ordered)];
}

export function isGoogleCapability(value: string | null): value is GoogleWorkspaceCapability {
  return value === "read" || value === "draft" || value === "calendar-write" || value === "send";
}

export async function encryptConnectorSecret(value: string) {
  const key = await connectorEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return { ciphertext: base64Url(new Uint8Array(ciphertext)), iv: base64Url(iv), keyVersion: 1 };
}

export async function decryptConnectorSecret(ciphertext: string, iv: string) {
  const key = await connectorEncryptionKey();
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, key, fromBase64Url(ciphertext));
  return new TextDecoder().decode(plaintext);
}
