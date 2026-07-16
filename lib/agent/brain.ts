import type { RiskClass, SafeToolName } from "./contracts";
import { interpretRequest } from "./semantic-brain";

export type NookBehavior = {
  initiative: "low" | "balanced" | "proactive";
  explanationDepth: "brief" | "clear" | "deep";
  updateFrequency: "quiet" | "milestones" | "frequent";
};
export type MemoryKind =
  | "profile"
  | "preference"
  | "project"
  | "workflow"
  | "correction"
  | "temporary";
export type NookMemory = {
  id: string;
  kind: MemoryKind;
  content: string;
  projectId?: string | null;
  pinned?: boolean;
  expiresAt?: string | null;
  usefulness?: number;
};
export type PerceptionResult = {
  normalizedRequest: string;
  probableIntent:
    | "ask"
    | "research"
    | "draft"
    | "navigate"
    | "change_preference"
    | "guided_workflow"
    | "unknown";
  missingInformation: string[];
  possibleSensitiveData: boolean;
  needsClarification: boolean;
  confidence: number;
};
export type ResearchDecision = {
  required: boolean;
  reason: string;
  freshnessRequirement: "none" | "recent" | "current";
  preferredSources: string[];
  domainRestrictions: string[];
};
export type SafeToolDescriptor = {
  name: SafeToolName;
  version: string;
  description: string;
};
export type NookContext = {
  nook: { id: string; name: string; behavior: NookBehavior };
  currentRequest: string;
  relevantMemories: NookMemory[];
  recentTaskSummaries: string[];
  availableTools: SafeToolDescriptor[];
  connectedProviders: string[];
  explicitUserConstraints: string[];
};
export type CognitivePlanStep = {
  id: string;
  title: string;
  explanation: string;
  mode: "clarification" | "tool" | "user_action" | "presentation";
  proposedTool: string | null;
  proposedInput: Record<string, unknown> | null;
  expectedResult: string;
  riskClass: RiskClass;
  requiresApproval: boolean;
};
export type MemoryProposal = {
  kind: Exclude<MemoryKind, "temporary">;
  title: string;
  content: string;
  reason: string;
  confidence: number;
  sourceTaskId: string;
  expiresAt: string | null;
};
export type TaskReflection = {
  outcome: "completed" | "partial" | "failed" | "blocked";
  whatWorked: string[];
  whatFailed: string[];
  userCorrections: string[];
  reusablePreferenceCandidates: string[];
  possibleMemory: MemoryProposal | null;
};

const SECRET =
  /\b(?:password|passcode|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|private key|recovery code|authentication code|cookie)\b/i;
const CURRENT =
  /\b(?:latest|newest|current|today|recent|price|pricing|fee|policy|requirement|documentation|legal|law|news)\b/i;

export function perceiveRequest(raw: string): PerceptionResult {
  const normalizedRequest = raw.trim().replace(/\s+/g, " ");
  const semantic = interpretRequest(normalizedRequest);
  const preference =
    /\b(?:prefer|preference|be more|be less|always ask|concise|detailed)\b/i.test(
      normalizedRequest,
    );
  const research =
    /\b(?:research|look up|compare|find sources?)\b/i.test(normalizedRequest) ||
    CURRENT.test(normalizedRequest);
  const navigate =
    /\bopen\b.{0,30}\b(?:page|site|url|facebook|linkedin|docs)\b/i.test(
      normalizedRequest,
    );
  const guided =
    /\b(?:create|set up|setup)\b.{0,25}\bfacebook (?:business )?page\b/i.test(
      normalizedRequest,
    );
  const draft =
    /\b(?:draft|write|rewrite|description|bio|caption|outline|checklist)\b/i.test(
      normalizedRequest,
    );
  const missingInformation: string[] = [];
  if (guided) {
    if (
      !/\b(?:business|company|brand|page) (?:name|called)\b/i.test(
        normalizedRequest,
      )
    )
      missingInformation.push("Business name");
    if (!/\bcategory\b/i.test(normalizedRequest))
      missingInformation.push("Business category");
    if (!/\b(?:description|bio)\s*[:=-]/i.test(normalizedRequest))
      missingInformation.push("Business description");
  }
  const semanticIntent =
    semantic.intent === "browser_open" || semantic.intent === "browser_search"
      ? "navigate"
      : semantic.intent === "teach_preference"
        ? "change_preference"
        : semantic.intent === "guided_workflow"
          ? "guided_workflow"
          : semantic.intent === "research"
            ? "research"
            : semantic.intent === "draft"
              ? "draft"
              : null;
  if (semantic.needsClarification && semantic.clarification)
    missingInformation.push(semantic.clarification);
  const probableIntent = semanticIntent ?? (preference
    ? "change_preference"
    : research
      ? "research"
      : navigate
        ? "navigate"
        : guided
          ? "guided_workflow"
          : draft
            ? "draft"
            : normalizedRequest
              ? "ask"
              : "unknown");
  return {
    normalizedRequest,
    probableIntent,
    missingInformation,
    possibleSensitiveData: SECRET.test(normalizedRequest),
    needsClarification: missingInformation.length > 0,
    confidence:
      semantic.confidence === "high"
        ? 0.95
        : semantic.confidence === "medium"
          ? 0.65
          : normalizedRequest
            ? 0.35
            : 0,
  };
}

export function decideResearch(perception: PerceptionResult): ResearchDecision {
  const required =
    perception.probableIntent === "research" ||
    CURRENT.test(perception.normalizedRequest);
  return {
    required,
    reason: required
      ? "The request depends on information that may have changed."
      : "The request can be completed from user-provided or stable information.",
    freshnessRequirement: required
      ? CURRENT.test(perception.normalizedRequest)
        ? "current"
        : "recent"
      : "none",
    preferredSources: required
      ? ["official documentation", "primary sources"]
      : [],
    domainRestrictions: [],
  };
}

/**
 * A small, inspectable attention mechanism. It ranks approved memories by
 * relevance, durability, correction value, and demonstrated usefulness rather
 * than sending the whole memory store into every task.
 */
export function scoreMemorySalience(
  memory: NookMemory,
  request: string,
  projectId?: string | null,
  now = new Date(),
) {
  if (memory.expiresAt && Date.parse(memory.expiresAt) <= now.getTime())
    return Number.NEGATIVE_INFINITY;
  if (memory.projectId && memory.projectId !== projectId)
    return Number.NEGATIVE_INFINITY;
  const words = new Set(request.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const memoryWords = new Set(
    memory.content.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [],
  );
  const overlap = [...words].filter((word) => memoryWords.has(word)).length;
  const lexical = words.size ? (overlap / words.size) * 8 : 0;
  const kindWeight: Partial<Record<MemoryKind, number>> = {
    correction: 1.5,
    workflow: 0.75,
    preference: 1.5,
    profile: 1,
    project: 0,
  };
  return (
    lexical +
    (memory.pinned ? 6 : 0) +
    (kindWeight[memory.kind] ?? 0) +
    Math.log2(1 + Math.max(0, memory.usefulness ?? 0))
  );
}

export function assembleContext(args: {
  nook: NookContext["nook"];
  request: string;
  memories: NookMemory[];
  recentTaskSummaries: string[];
  availableTools: SafeToolDescriptor[];
  connectedProviders: string[];
  explicitUserConstraints: string[];
  projectId?: string | null;
  now?: Date;
}): NookContext {
  const now = args.now ?? new Date();
  const relevantMemories = args.memories
    .map((memory) => ({
      memory: { ...memory, content: memory.content.slice(0, 500) },
      salience: scoreMemorySalience(
        memory,
        args.request,
        args.projectId,
        now,
      ),
    }))
    .filter(
      ({ memory, salience }) =>
        Number.isFinite(salience) && (salience >= 1 || memory.pinned),
    )
    .sort((a, b) => b.salience - a.salience)
    .slice(0, 8);
  return {
    nook: args.nook,
    currentRequest: args.request.slice(0, 1200),
    relevantMemories: relevantMemories.map(({ memory }) => memory),
    recentTaskSummaries: args.recentTaskSummaries
      .slice(0, 5)
      .map((v) => v.slice(0, 300)),
    availableTools: args.availableTools.slice(0, 12),
    connectedProviders: args.connectedProviders.slice(0, 8),
    explicitUserConstraints: args.explicitUserConstraints
      .slice(0, 8)
      .map((v) => v.slice(0, 300)),
  };
}

export function safeDecisionSummary(
  perception: PerceptionResult,
  research: ResearchDecision,
  tools: string[],
  memoryCount: number,
) {
  return {
    intentDetected: perception.probableIntent,
    currentInformationRequired: research.required,
    toolsSelected: tools.slice(0, 3),
    approvalRequired: false,
    memoriesUsed: memoryCount,
    externalChanges: "none" as const,
  };
}
