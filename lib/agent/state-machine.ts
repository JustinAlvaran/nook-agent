import type { StepStatus, TaskStatus } from "./contracts";

const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  draft: ["planning", "cancelled"],
  planning: ["policy_review", "blocked", "failed", "cancelled"],
  policy_review: ["ready", "awaiting_approval", "blocked", "failed", "cancelled"],
  ready: ["running", "cancelled"],
  running: ["awaiting_approval", "retry_wait", "completed", "blocked", "failed", "cancelled"],
  awaiting_approval: ["running", "cancelled", "expired", "blocked"],
  retry_wait: ["running", "failed", "cancelled"],
  completed: [],
  blocked: [],
  cancelled: [],
  failed: [],
  expired: [],
};

const STEP_TRANSITIONS: Record<StepStatus, readonly StepStatus[]> = {
  queued: ["running", "cancelled", "blocked"],
  running: ["awaiting_approval", "dispatching", "verifying", "retry_wait", "succeeded", "blocked", "failed", "cancelled"],
  awaiting_approval: ["approved", "rejected", "expired", "cancelled"],
  approved: ["dispatching", "cancelled"],
  rejected: ["cancelled"],
  dispatching: ["verifying", "retry_wait", "failed", "cancelled"],
  verifying: ["succeeded", "retry_wait", "failed", "blocked"],
  retry_wait: ["running", "dispatching", "verifying", "failed", "cancelled"],
  succeeded: [],
  blocked: [],
  cancelled: [],
  failed: [],
  expired: [],
};

export class InvalidAgentTransitionError extends Error {
  constructor(scope: "task" | "step", from: string, to: string) {
    super(`Invalid ${scope} transition: ${from} -> ${to}`);
    this.name = "InvalidAgentTransitionError";
  }
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

export function canTransitionStep(from: StepStatus, to: StepStatus): boolean {
  return STEP_TRANSITIONS[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) throw new InvalidAgentTransitionError("task", from, to);
}

export function assertStepTransition(from: StepStatus, to: StepStatus): void {
  if (!canTransitionStep(from, to)) throw new InvalidAgentTransitionError("step", from, to);
}

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return TASK_TRANSITIONS[status].length === 0;
}

export function isTerminalStepStatus(status: StepStatus): boolean {
  return STEP_TRANSITIONS[status].length === 0;
}
