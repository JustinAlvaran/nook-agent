import { AGENT_CONTRACT_VERSION, type ActionReceipt, type HashedAction } from "./contracts";

export function createActionReceipt(
  action: HashedAction,
  result: Omit<ActionReceipt, "contractVersion" | "receiptId" | "actionId" | "actionHash" | "taskId" | "stepId" | "reversible">,
): ActionReceipt {
  return {
    contractVersion: AGENT_CONTRACT_VERSION,
    receiptId: `receipt_${action.actionHash.slice(0, 32)}_${result.attempt}`,
    actionId: action.actionId,
    actionHash: action.actionHash,
    taskId: action.taskId,
    stepId: action.stepId,
    reversible: action.reversible,
    ...result,
  };
}

export function receiptCompletesAction(receipt: ActionReceipt): boolean {
  return receipt.status === "succeeded" || receipt.status === "simulated";
}
