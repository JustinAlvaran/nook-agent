export type RiskClass = 0 | 1 | 2 | 3;

/** Bump when a persisted action, approval, receipt, or run-state shape changes. */
export const AGENT_CONTRACT_VERSION = "nook-agent-contract@2" as const;
export const AGENT_GRAPH_VERSION = "nook-manager@2" as const;

export type TaskStatus =
  | "draft"
  | "planning"
  | "policy_review"
  | "ready"
  | "running"
  | "awaiting_approval"
  | "retry_wait"
  | "completed"
  | "blocked"
  | "cancelled"
  | "failed"
  | "expired";

export type StepStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "dispatching"
  | "verifying"
  | "retry_wait"
  | "succeeded"
  | "blocked"
  | "cancelled"
  | "failed"
  | "expired";

export type AgentCapability =
  | "research"
  | "draft"
  | "verify"
  | "connector_read"
  | "connector_write";

export type AgentBudget = {
  maxTurns: number;
  maxOutputTokens: number;
  maxToolCalls: number;
  maxWallTimeMs: number;
  maxCostUsd?: number;
};

export type ActionEnvelope = {
  contractVersion: typeof AGENT_CONTRACT_VERSION;
  taskId: string;
  planVersion: number;
  stepId: string;
  actionType: string;
  connector: string;
  arguments: Record<string, unknown>;
  externalEffect: boolean;
  reversible: boolean;
  estimatedCostCents: number;
  requestedRisk: RiskClass;
};

export type HashedAction = ActionEnvelope & {
  actionId: string;
  actionHash: string;
  idempotencyKey: string;
};

export type PolicyDecision = {
  effectiveRisk: RiskClass;
  blocked: boolean;
  blockedReason: string;
  requiresApproval: boolean;
  requiresFreshAuth: boolean;
};

export type ApprovalIntent = {
  id: string;
  actionId: string;
  actionHash: string;
  taskId: string;
  stepId: string;
  toolName: string;
  destinationLabel: string;
  preview: string;
  riskClass: RiskClass;
  reversible: boolean;
  estimatedCostCents: number;
  requiresFreshAuth: boolean;
  status: "pending" | "approved" | "rejected" | "expired";
  expiresAt: string;
};

export type ApprovalDecision = {
  approvalId: string;
  actionHash: string;
  decision: "approve" | "reject";
  decidedByUserId: string;
  decidedAt: string;
  freshAuthAt?: string;
  rejectionMessage?: string;
};

export type ActionReceipt = {
  contractVersion: typeof AGENT_CONTRACT_VERSION;
  receiptId: string;
  actionId: string;
  actionHash: string;
  taskId: string;
  stepId: string;
  attempt: number;
  status: "simulated" | "succeeded" | "failed" | "uncertain";
  providerReference?: string;
  summary: string;
  reversible: boolean;
  undoUntil?: string;
  startedAt: string;
  completedAt: string;
  evidenceRefs: string[];
};

export type SerializedAgentRun = {
  graphVersion: typeof AGENT_GRAPH_VERSION;
  sdkVersion: string;
  promptVersion: string;
  state: string;
  stateHash: string;
  interruptionIds: string[];
  createdAt: string;
};

export type PlanStep = {
  id: string;
  title: string;
  detail: string;
  kind: "explain" | "research" | "draft" | "open_link" | "external_effect";
  mode: "instruction" | "tool";
  toolName: SafeToolName | null;
  toolVersion: string | null;
  toolInput: Record<string, unknown> | null;
  riskClass: RiskClass;
  externalEffect: boolean;
  requiresApproval: boolean;
  dependsOnStepId?: string | null;
};

export type SafeToolName =
  | "create_draft"
  | "open_supported_url"
  | "guided_workflow"
  | "save_nook_preference"
  | "search_web"
  | "summarize_sources"
  | "propose_memory";

export type TaskPlan = {
  summary: string;
  userMessage: string;
  riskClass: RiskClass;
  requiresApproval: boolean;
  blocked: boolean;
  blockedReason: string;
  steps: PlanStep[];
};

export type PlannedTask = {
  id: string;
  input: string;
  status: "ready" | "awaiting_approval" | "blocked";
  plan: TaskPlan;
  persisted: boolean;
};
