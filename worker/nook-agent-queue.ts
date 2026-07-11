import type { ActionReceipt, HashedAction } from "../lib/agent/contracts";
import { createActionReceipt } from "../lib/agent/receipts";
import { classifyAgentError } from "../lib/agent/retry";

export type ExecutionWorkItem = {
  taskId: string;
  workflowId: string;
  action: HashedAction;
};

export interface QueueMessageLike<T> {
  body: T;
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

export interface ExecutionReceiptStore {
  findByActionId(actionId: string): Promise<ActionReceipt | null>;
  saveIfAbsent(receipt: ActionReceipt): Promise<ActionReceipt>;
}

export interface ConnectorExecutor {
  execute(action: HashedAction): Promise<{ providerReference?: string; summary: string; evidenceRefs?: string[] }>;
  reconcile(action: HashedAction): Promise<{ providerReference?: string; summary: string; evidenceRefs?: string[] } | null>;
}

export interface WorkflowResultSender {
  send(workflowId: string, event: { type: "work-result"; payload: { actionId: string; receiptId: string } }): Promise<void>;
}

/** At-least-once-safe Queue consumer unit. Never retry an uncertain effect before reconciliation. */
export async function consumeExecutionMessage(
  message: QueueMessageLike<ExecutionWorkItem>,
  dependencies: { receipts: ExecutionReceiptStore; executor: ConnectorExecutor; workflows: WorkflowResultSender; now?: () => Date },
): Promise<void> {
  const { action, workflowId } = message.body;
  const existing = await dependencies.receipts.findByActionId(action.actionId);
  if (existing) {
    await dependencies.workflows.send(workflowId, { type: "work-result", payload: { actionId: action.actionId, receiptId: existing.receiptId } });
    message.ack();
    return;
  }

  const now = dependencies.now || (() => new Date());
  const startedAt = now().toISOString();
  try {
    const result = await dependencies.executor.execute(action);
    const receipt = await dependencies.receipts.saveIfAbsent(createActionReceipt(action, {
      attempt: message.attempts,
      status: "succeeded",
      summary: result.summary,
      providerReference: result.providerReference,
      startedAt,
      completedAt: now().toISOString(),
      evidenceRefs: result.evidenceRefs || [],
    }));
    await dependencies.workflows.send(workflowId, { type: "work-result", payload: { actionId: action.actionId, receiptId: receipt.receiptId } });
    message.ack();
  } catch (error) {
    const errorClass = classifyAgentError(error);
    if (errorClass === "uncertain") {
      const reconciled = await dependencies.executor.reconcile(action);
      if (reconciled) {
        const receipt = await dependencies.receipts.saveIfAbsent(createActionReceipt(action, {
          attempt: message.attempts,
          status: "succeeded",
          summary: reconciled.summary,
          providerReference: reconciled.providerReference,
          startedAt,
          completedAt: now().toISOString(),
          evidenceRefs: reconciled.evidenceRefs || [],
        }));
        await dependencies.workflows.send(workflowId, { type: "work-result", payload: { actionId: action.actionId, receiptId: receipt.receiptId } });
        message.ack();
        return;
      }
    }
    if (errorClass === "transient" || errorClass === "rate_limit" || errorClass === "uncertain") {
      message.retry(); // The Queue consumer's max_retries moves exhausted work to its DLQ.
      return;
    }
    const receipt = await dependencies.receipts.saveIfAbsent(createActionReceipt(action, {
      attempt: message.attempts,
      status: "failed",
      summary: `Connector refused the action (${errorClass}).`,
      startedAt,
      completedAt: now().toISOString(),
      evidenceRefs: [],
    }));
    await dependencies.workflows.send(workflowId, { type: "work-result", payload: { actionId: action.actionId, receiptId: receipt.receiptId } });
    message.ack();
  }
}
