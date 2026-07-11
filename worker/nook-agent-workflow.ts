import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { SafeSimulatorRuntime, type AgentRunOutcome } from "../lib/agent/coordinator";

export type NookWorkflowParams = {
  taskId: string;
  input: string;
  mode?: "simulator";
};

export type ApprovalResumeEvent = {
  approvalId: string;
  actionHash: string;
  decision: "approve" | "reject";
};

/**
 * Durable control-plane skeleton. The deployed default is intentionally the
 * side-effect-free simulator; wire a persisted Agents SDK runtime only after
 * its secrets, checkpoint store, approval endpoint, and receipts exist.
 */
export class NookAgentWorkflow extends WorkflowEntrypoint<Record<string, never>, NookWorkflowParams> {
  async run(event: WorkflowEvent<NookWorkflowParams>, step: WorkflowStep): Promise<AgentRunOutcome> {
    const outcome = await step.do(
      "simulator-agent-turn-v1",
      { retries: { limit: 3, delay: "2 seconds", backoff: "exponential" }, timeout: "2 minutes" },
      async () => new SafeSimulatorRuntime().run(event.payload.input),
    );

    if (outcome.kind !== "awaiting_approval") return outcome;

    try {
      const approval = await step.waitForEvent<ApprovalResumeEvent>("wait-for-approval-v1", {
        type: "approval-resume",
        timeout: "7 days",
      });
      if (!outcome.approvalIds.includes(approval.payload.approvalId)) {
        return { kind: "blocked", summary: "Approval mismatch", reason: "The approval event did not match the paused run." };
      }
      if (approval.payload.decision === "reject") {
        return { kind: "blocked", summary: "Action rejected", reason: "The user rejected the proposed external effect." };
      }
      return {
        kind: "blocked",
        summary: "Live execution is not installed",
        reason: "Approval was recorded, but the safe simulator never performs external effects.",
      };
    } catch {
      return { kind: "blocked", summary: "Approval expired", reason: "No matching decision arrived before the approval timeout." };
    }
  }
}
