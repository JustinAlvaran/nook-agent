import type { TaskPlan } from "./contracts";
import type {
  NookBehavior,
  NookMemory,
  ProductTaskOutput,
} from "./product-runner";

export const KEYLESS_CORE_VERSION = "nook-cognitive-core@1" as const;

function compact(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max
    ? normalized
    : `${normalized.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function taskLabel(input: string) {
  const first = compact(input.split(/[\n.!?]/)[0] || input, 72);
  return first || "Untitled Nook task";
}

/**
 * The reflex lane: a model-independent proposal that is always passed through
 * the deterministic policy and tool compiler before it can run.
 */
export function createKeylessPlanProposal(input: string): TaskPlan {
  const label = taskLabel(input);
  return {
    summary: label,
    userMessage:
      "Nook Core prepared a bounded plan locally. A model may improve wording, but it cannot grant tools or permissions.",
    riskClass: 0,
    requiresApproval: false,
    blocked: false,
    blockedReason: "",
    steps: [
      {
        id: "core_intent",
        title: "Route the request through Nook Core",
        detail:
          "Match the request to an allowlisted skill, then stop at any approval boundary.",
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
}

function requestedArtifact(input: string) {
  if (/\b(?:caption|social post|announcement|tweet|thread)\b/i.test(input))
    return "social post";
  if (/\b(?:landing page|website|page copy|homepage)\b/i.test(input))
    return "page copy";
  if (/\bchecklist\b/i.test(input)) return "checklist";
  if (/\b(?:outline|plan|roadmap)\b/i.test(input)) return "outline";
  return "working brief";
}

function artifactBody(input: string, label: string) {
  const goal = compact(input, 900);
  const kind = requestedArtifact(input);
  if (kind === "social post")
    return [
      `## ${label}`,
      "",
      "**Opening**",
      `Here is what we are making: ${goal}`,
      "",
      "**Why it matters**",
      "State the one concrete benefit the reader gets, using a fact you can verify.",
      "",
      "**Call to action**",
      "Choose one next action for the reader. Replace this line before publishing.",
    ].join("\n");
  if (kind === "page copy")
    return [
      `# ${label}`,
      "",
      `## The promise\n${goal}`,
      "",
      "## What the visitor can do",
      "- Understand the outcome in one scan",
      "- See what is included and what remains under their control",
      "- Take one clear next step",
      "",
      "## Proof to add",
      "Add only verified examples, measurements, or customer evidence.",
      "",
      "## Primary action",
      "Replace this line with one specific button label.",
    ].join("\n");
  return [
    `# ${label}`,
    "",
    `## Outcome\n${goal}`,
    "",
    "## Working sequence",
    "1. Confirm the exact deliverable and success condition.",
    "2. Gather only the facts and source material needed for it.",
    "3. Build the smallest complete version.",
    "4. Check it against the request and visible constraints.",
    "5. Present the result before any external change.",
    "",
    "## Known boundary",
    "This artifact was assembled by the keyless Nook Core. Claims that require live evidence remain explicitly unverified.",
  ].join("\n");
}

/** A useful offline fallback, not a simulation of model reasoning. */
export function runKeylessProductTask(args: {
  input: string;
  nookName: string;
  behavior: NookBehavior;
  memories: NookMemory[];
}): ProductTaskOutput {
  const label = taskLabel(args.input);
  const approvedContext = args.memories
    .slice(0, 3)
    .map((memory) => `- ${compact(memory.content, 160)}`);
  const body = artifactBody(args.input, label);
  const memorySection = approvedContext.length
    ? `\n\n## Approved context applied\n${approvedContext.join("\n")}`
    : "";
  return {
    title: label,
    summary: `${args.nookName} produced a ${requestedArtifact(args.input)} with the keyless cognitive core.`,
    resultMarkdown: `${body}${memorySection}`,
    whatChanged: [
      "Routed the request through the deterministic cognitive cycle",
      "Produced a local artifact without a hosted model or API key",
      ...(approvedContext.length
        ? [`Applied ${approvedContext.length} user-approved memories`]
        : []),
    ],
    nextSuggestedAction:
      args.behavior.explanationDepth === "deep"
        ? "Review the assumptions and replace any marked evidence gaps before using the artifact externally."
        : "Review the artifact and fill any marked evidence gaps.",
  };
}
