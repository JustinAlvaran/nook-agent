export type AgentErrorClass = "transient" | "rate_limit" | "auth" | "policy" | "invalid_input" | "permanent" | "uncertain";

export type RetryPolicy = { maxAttempts: number; baseDelayMs: number; maxDelayMs: number };

export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 60_000 };

export function classifyAgentError(error: unknown): AgentErrorClass {
  const candidate = error as { status?: number; code?: string; name?: string; uncertain?: boolean };
  if (candidate?.uncertain) return "uncertain";
  if (candidate?.status === 429 || candidate?.code === "rate_limit_exceeded") return "rate_limit";
  if (candidate?.status === 401 || candidate?.status === 403) return "auth";
  if (candidate?.name === "PolicyError") return "policy";
  if (candidate?.status === 400 || candidate?.name === "ValidationError") return "invalid_input";
  if (candidate?.status && candidate.status >= 500) return "transient";
  if (candidate instanceof TypeError) return "invalid_input";
  return "permanent";
}

export function shouldRetry(errorClass: AgentErrorClass, attempt: number, policy = DEFAULT_RETRY_POLICY): boolean {
  return attempt < policy.maxAttempts && (errorClass === "transient" || errorClass === "rate_limit");
}

export function retryDelayMs(attempt: number, policy = DEFAULT_RETRY_POLICY, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return Math.min(policy.maxDelayMs, Math.max(0, retryAfterMs));
  const delay = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(policy.maxDelayMs, delay);
}
