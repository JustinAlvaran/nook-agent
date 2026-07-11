import {
  AGENT_CONTRACT_VERSION,
  type ActionEnvelope,
  type ApprovalDecision,
  type ApprovalIntent,
  type HashedAction,
  type PolicyDecision,
} from "./contracts";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Action values must be finite");
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashAction(action: ActionEnvelope): Promise<HashedAction> {
  if (action.contractVersion !== AGENT_CONTRACT_VERSION) throw new TypeError("Unsupported action contract version");
  const actionHash = await sha256(canonicalJson(action));
  const actionId = `act_${actionHash.slice(0, 32)}`;
  return { ...action, actionId, actionHash, idempotencyKey: `nook_${actionHash}` };
}

export function createApprovalIntent(
  action: HashedAction,
  policy: PolicyDecision,
  details: { toolName: string; destinationLabel: string; preview: string; expiresAt: string },
): ApprovalIntent {
  if (!policy.requiresApproval || policy.blocked) throw new TypeError("Approval intent requires an allowed approval-gated action");
  return {
    id: `approval_${action.actionHash.slice(0, 32)}`,
    actionId: action.actionId,
    actionHash: action.actionHash,
    taskId: action.taskId,
    stepId: action.stepId,
    toolName: details.toolName,
    destinationLabel: details.destinationLabel,
    preview: details.preview,
    riskClass: policy.effectiveRisk,
    reversible: action.reversible,
    estimatedCostCents: action.estimatedCostCents,
    requiresFreshAuth: policy.requiresFreshAuth,
    status: "pending",
    expiresAt: details.expiresAt,
  };
}

export function validateApprovalDecision(intent: ApprovalIntent, decision: ApprovalDecision, now = new Date()): void {
  if (intent.status !== "pending") throw new TypeError("Approval is no longer pending");
  if (intent.id !== decision.approvalId || intent.actionHash !== decision.actionHash) throw new TypeError("Approval does not match the immutable action");
  if (Date.parse(intent.expiresAt) <= now.getTime()) throw new TypeError("Approval has expired");
  if (intent.requiresFreshAuth && decision.decision === "approve" && !decision.freshAuthAt) throw new TypeError("Fresh authentication is required");
}
