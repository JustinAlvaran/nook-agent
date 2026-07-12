import {
  AGENT_CONTRACT_VERSION,
  type AgentBudget,
  type HashedAction,
  type TaskPlan,
  type TaskStatus,
} from "./contracts";
import { enforcePolicy } from "./policy";

export const DEFAULT_AGENT_BUDGET: AgentBudget = {
  maxTurns: 8,
  maxOutputTokens: 2_000,
  maxToolCalls: 4,
  maxWallTimeMs: 60_000,
};

export type AgentRunOutcome =
  | { kind: "completed"; summary: string; finalOutput: string }
  | {
      kind: "awaiting_approval";
      summary: string;
      checkpointRef: string;
      approvalIds: string[];
    }
  | { kind: "blocked"; summary: string; reason: string }
  | { kind: "failed"; summary: string; retryable: boolean; errorClass: string };

export type CoordinatorEvent = {
  taskId: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export interface CoordinatorStore {
  compareAndSetTaskStatus(
    taskId: string,
    from: TaskStatus,
    to: TaskStatus,
  ): Promise<boolean>;
  appendEvent(event: CoordinatorEvent): Promise<void>;
  findReceipt(actionId: string): Promise<{ receiptId: string } | null>;
}

export interface AgentRuntime {
  run(input: string, budget: AgentBudget): Promise<AgentRunOutcome>;
}

export interface ExecutionQueue {
  send(message: {
    taskId: string;
    workflowId: string;
    action: HashedAction;
  }): Promise<void>;
}

/**
 * Honest fallback for local/free-tier deployments. It plans but never invokes a
 * model, connector, browser, desktop capability, or external effect.
 */
export class SafeSimulatorRuntime implements AgentRuntime {
  async run(input: string): Promise<AgentRunOutcome> {
    const proposed: TaskPlan = {
      summary: "Prepared a supervised simulation",
      userMessage:
        "This simulator shows the gate but does not perform external actions.",
      riskClass: 0,
      requiresApproval: false,
      blocked: false,
      blockedReason: "",
      steps: [
        {
          id: "step_1",
          title: "Review the request",
          detail: "Prepare a bounded, non-executing preview.",
          kind: "explain",
          mode: "instruction",
          toolName: null,
          toolVersion: null,
          toolInput: null,
          riskClass: 0,
          externalEffect: false,
          requiresApproval: false,
        },
      ],
    };
    const plan = enforcePolicy(input, proposed);
    if (plan.blocked)
      return {
        kind: "blocked",
        summary: plan.summary,
        reason: plan.blockedReason,
      };
    return {
      kind: "completed",
      summary: plan.summary,
      finalOutput: JSON.stringify({
        contractVersion: AGENT_CONTRACT_VERSION,
        simulated: true,
        plan,
      }),
    };
  }
}

export async function runCoordinatedTask(
  taskId: string,
  input: string,
  runtime: AgentRuntime,
  store: CoordinatorStore,
  budget = DEFAULT_AGENT_BUDGET,
): Promise<AgentRunOutcome> {
  if (!(await store.compareAndSetTaskStatus(taskId, "ready", "running"))) {
    return {
      kind: "failed",
      summary: "Task was not ready",
      retryable: false,
      errorClass: "state_conflict",
    };
  }
  await store.appendEvent({
    taskId,
    type: "agent.run.started",
    message: "Nook started a bounded agent run.",
    metadata: { budget },
  });
  const outcome = await runtime.run(input, budget);
  const next: TaskStatus =
    outcome.kind === "completed"
      ? "completed"
      : outcome.kind === "awaiting_approval"
        ? "awaiting_approval"
        : outcome.kind;
  await store.compareAndSetTaskStatus(taskId, "running", next);
  await store.appendEvent({
    taskId,
    type: `agent.run.${outcome.kind}`,
    message: outcome.summary,
  });
  return outcome;
}
