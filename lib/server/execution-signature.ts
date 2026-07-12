export class MissingExecutionSecretError extends Error {}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signServerOperation(operation: string, ownerId: string, resource: string) {
  const secret = process.env.TASK_EXECUTION_SECRET;
  if (!secret || secret.length < 32) throw new MissingExecutionSecretError("TASK_EXECUTION_SECRET is not configured");
  const expiresAt = Math.floor(Date.now() / 1_000) + 90;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${operation}:${ownerId}:${resource}:${expiresAt}`),
  );
  return { expiresAt, signature: hex(signature) };
}
