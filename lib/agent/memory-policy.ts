export const MEMORY_KINDS = [
  "profile",
  "preference",
  "project",
  "workflow",
  "correction",
  "temporary",
] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];
const SECRET_PATTERNS = [
  /\b(?:password|passcode|pin)\b/i,
  /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|private key|recovery code|authentication code|one[- ]time code|cookie)\b/i,
  /\b(?:\d[ -]*?){13,19}\b/,
];
export function containsProhibitedMemory(content: string) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(content));
}
export function validateMemoryContent(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 500)
    return { ok: false as const, error: "Memory must be 2–500 characters." };
  if (containsProhibitedMemory(normalized))
    return {
      ok: false as const,
      error:
        "Nook cannot store passwords, authentication data, private keys, cookies, or payment-card data.",
    };
  return { ok: true as const, content: normalized };
}
export function memoryIsRetrievable(
  memory: { status: string; expiresAt?: string | null },
  now = new Date(),
) {
  return (
    memory.status === "active" &&
    (!memory.expiresAt || Date.parse(memory.expiresAt) > now.getTime())
  );
}
