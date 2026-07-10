export type RiskClass = 0 | 1 | 2 | 3;

export type PlanStep = {
  id: string;
  title: string;
  detail: string;
  kind: "explain" | "research" | "draft" | "open_link" | "external_effect";
  requiresApproval: boolean;
};

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
