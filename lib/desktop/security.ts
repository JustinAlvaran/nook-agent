const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createPairingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function createDeviceToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashSecret(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toUpperCase()));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
