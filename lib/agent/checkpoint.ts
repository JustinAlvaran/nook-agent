import { AGENT_GRAPH_VERSION, type ApprovalDecision, type SerializedAgentRun } from "./contracts";
import { sha256 } from "./action";

export type ApprovalInterruptionDescriptor = {
  id: string;
  toolName: string;
  argumentsJson: string;
  agentName: string;
};

export type AgentRunCheckpoint = {
  serialized: SerializedAgentRun;
  interruptions: ApprovalInterruptionDescriptor[];
};

export interface SerializableRunState {
  toString(options?: { includeTracingApiKey?: boolean }): string;
}

export interface RestoredApprovalState<TInterruption> {
  approve(interruption: TInterruption): void;
  reject(interruption: TInterruption, options?: { message?: string }): void;
}

export async function createRunCheckpoint(
  state: SerializableRunState,
  interruptions: ApprovalInterruptionDescriptor[],
  versions: { sdkVersion: string; promptVersion: string },
  createdAt = new Date().toISOString(),
): Promise<AgentRunCheckpoint> {
  const serializedState = state.toString({ includeTracingApiKey: false });
  return {
    serialized: {
      graphVersion: AGENT_GRAPH_VERSION,
      sdkVersion: versions.sdkVersion,
      promptVersion: versions.promptVersion,
      state: serializedState,
      stateHash: await sha256(serializedState),
      interruptionIds: interruptions.map((item) => item.id),
      createdAt,
    },
    interruptions,
  };
}

export async function verifyRunCheckpoint(checkpoint: AgentRunCheckpoint): Promise<void> {
  if (checkpoint.serialized.graphVersion !== AGENT_GRAPH_VERSION) throw new TypeError("Agent graph version is unavailable");
  if (await sha256(checkpoint.serialized.state) !== checkpoint.serialized.stateHash) throw new TypeError("Serialized RunState hash mismatch");
  if (checkpoint.interruptions.some((item, index) => item.id !== checkpoint.serialized.interruptionIds[index])) {
    throw new TypeError("Approval interruptions do not match the serialized RunState");
  }
}

export function applyApprovalDecisions<TInterruption>(
  state: RestoredApprovalState<TInterruption>,
  interruptions: ReadonlyMap<string, TInterruption>,
  decisions: readonly ApprovalDecision[],
): void {
  for (const decision of decisions) {
    const interruption = interruptions.get(decision.approvalId);
    if (!interruption) throw new TypeError(`Unknown approval interruption ${decision.approvalId}`);
    if (decision.decision === "approve") state.approve(interruption);
    else state.reject(interruption, { message: decision.rejectionMessage || "The user rejected this action." });
  }
}
