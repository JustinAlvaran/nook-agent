import { Runner, RunState } from "@openai/agents";
import { sha256 } from "./action";
import { createRunCheckpoint, type AgentRunCheckpoint, type ApprovalInterruptionDescriptor } from "./checkpoint";
import type { AgentBudget } from "./contracts";
import type { AgentRunOutcome, AgentRuntime } from "./coordinator";
import { buildNookManagerGraph, NOOK_PROMPT_VERSION } from "./graph";

type SdkInterruption = {
  name: string;
  arguments: string;
  agent: { name: string };
};

export type StartedSdkRun = {
  outcome: AgentRunOutcome;
  checkpoint?: AgentRunCheckpoint;
  interruptionItems?: ReadonlyMap<string, SdkInterruption>;
};

async function describeInterruptions(items: readonly SdkInterruption[]): Promise<ApprovalInterruptionDescriptor[]> {
  return Promise.all(items.map(async (item, index) => {
    const seed = `${index}:${item.agent.name}:${item.name}:${item.arguments}`;
    return { id: `approval_${(await sha256(seed)).slice(0, 32)}`, toolName: item.name, argumentsJson: item.arguments, agentName: item.agent.name };
  }));
}

export async function startSdkManagerRun(input: string, budget: AgentBudget, options?: { model?: string; sdkVersion?: string }): Promise<StartedSdkRun> {
  const graph = buildNookManagerGraph(options?.model);
  const runner = new Runner();
  const result = await runner.run(graph.manager, input, { maxTurns: budget.maxTurns });
  const interruptions = result.interruptions as readonly SdkInterruption[];
  if (interruptions.length > 0) {
    const descriptors = await describeInterruptions(interruptions);
    const checkpoint = await createRunCheckpoint(result.state, descriptors, {
      sdkVersion: options?.sdkVersion || "@openai/agents",
      promptVersion: NOOK_PROMPT_VERSION,
    });
    return {
      outcome: { kind: "awaiting_approval", summary: "Nook paused before an external effect.", checkpointRef: checkpoint.serialized.stateHash, approvalIds: descriptors.map((item) => item.id) },
      checkpoint,
      interruptionItems: new Map(descriptors.map((item, index) => [item.id, interruptions[index]])),
    };
  }
  return { outcome: { kind: "completed", summary: "Nook completed a bounded agent run.", finalOutput: String(result.finalOutput ?? "") } };
}

/** Rebuild the exact graph version before applying stored approval decisions. */
export async function restoreSdkRunState(checkpoint: AgentRunCheckpoint, model?: string) {
  const graph = buildNookManagerGraph(model);
  const state = await RunState.fromString(graph.manager, checkpoint.serialized.state);
  return { graph, state };
}

export class OpenAIAgentsRuntime implements AgentRuntime {
  constructor(private readonly options?: { model?: string; sdkVersion?: string }) {}
  async run(input: string, budget: AgentBudget): Promise<AgentRunOutcome> {
    return (await startSdkManagerRun(input, budget, this.options)).outcome;
  }
}
