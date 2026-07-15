import { hashSecret } from "../desktop/security";
import { createSupabaseAdminClient } from "../supabase/admin";

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+([A-Za-z0-9_-]{32,256})$/);
  return match?.[1] || null;
}

export async function authenticateBrowserDevice(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const tokenHash = await hashSecret(token);
  const { data } = await admin
    .from("devices")
    .select("id,owner_id,public_key,status,platform")
    .eq("token_hash", tokenHash)
    .eq("platform", "browser")
    .eq("status", "active")
    .maybeSingle();
  return data ? { ...data, tokenHash } : null;
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0),
  );
  return bytes.buffer;
}

export async function verifyDeviceReceipt(args: {
  publicKey: string;
  signature: string;
  receipt: unknown;
}) {
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      fromBase64Url(args.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      fromBase64Url(args.signature),
      new TextEncoder().encode(JSON.stringify(args.receipt)),
    );
  } catch {
    return false;
  }
}

