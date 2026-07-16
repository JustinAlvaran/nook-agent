import { z } from "zod";
import type { RiskClass, SafeToolName, TaskPlan } from "../contracts";
import { parseBrowserTask } from "../../browser/commands";
import { interpretRequest } from "../semantic-brain";

const draftInput = z
  .object({
    artifactType: z.enum([
      "page_copy",
      "social_post",
      "outline",
      "checklist",
      "general",
    ]),
    title: z.string().min(1).max(100),
    instructions: z.string().min(1).max(1_200),
  })
  .strict();

const supportedUrlInput = z
  .object({
    destination: z.enum(["facebook_pages", "linkedin", "google_docs"]),
  })
  .strict();

const guidedWorkflowInput = z
  .object({
    workflowId: z.literal("facebook_page_setup"),
    request: z.string().min(1).max(1_200),
  })
  .strict();

const preferenceInput = z.discriminatedUnion("field", [
  z
    .object({
      field: z.literal("initiative"),
      value: z.enum(["low", "balanced", "proactive"]),
    })
    .strict(),
  z
    .object({
      field: z.literal("explanationDepth"),
      value: z.enum(["brief", "clear", "deep"]),
    })
    .strict(),
  z
    .object({
      field: z.literal("updateFrequency"),
      value: z.enum(["quiet", "milestones", "frequent"]),
    })
    .strict(),
]);
const searchInput = z
  .object({
    query: z.string().min(1).max(500),
    freshness: z.enum(["any", "recent", "current"]),
    allowedDomains: z.array(z.string().min(1).max(253)).max(20).optional(),
    blockedDomains: z.array(z.string().min(1).max(253)).max(20).optional(),
    maxResults: z.number().int().min(1).max(10),
  })
  .strict();
const summarizeInput = z
  .object({
    sourceStepId: z.string().min(1).max(80),
    instruction: z.string().min(1).max(500),
  })
  .strict();
const proposalInput = z
  .object({
    kind: z.enum([
      "profile",
      "preference",
      "project",
      "workflow",
      "correction",
    ]),
    title: z.string().min(1).max(120),
    content: z.string().min(2).max(500),
    reason: z.string().min(1).max(300),
  })
  .strict();
const browserTabInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("open_provider"),
      provider: z.enum(["youtube", "google", "bing", "wikipedia", "github"]),
      disposition: z.literal("new_tab"),
    })
    .strict(),
  z
    .object({
      action: z.literal("search_provider"),
      provider: z.enum(["youtube", "google", "bing", "wikipedia", "github"]),
      query: z.string().min(1).max(300),
      disposition: z.literal("new_tab"),
    })
    .strict(),
]);

type ToolDefinition = {
  version: "1";
  riskClass: RiskClass;
  externalEffect: boolean;
  reversible: boolean;
  requiresApproval: boolean;
  permissionLabel: string;
  inputSchema: z.ZodType;
};

export const SAFE_TOOL_REGISTRY = Object.freeze({
  create_draft: {
    version: "1",
    riskClass: 0,
    externalEffect: false,
    reversible: true,
    requiresApproval: false,
    permissionLabel: "Save a draft inside Nook",
    inputSchema: draftInput,
  },
  open_supported_url: {
    version: "1",
    riskClass: 0,
    externalEffect: false,
    reversible: true,
    requiresApproval: false,
    permissionLabel: "Prepare a user-clickable supported link",
    inputSchema: supportedUrlInput,
  },
  guided_workflow: {
    version: "1",
    riskClass: 0,
    externalEffect: false,
    reversible: true,
    requiresApproval: false,
    permissionLabel: "Prepare a guided checklist inside Nook",
    inputSchema: guidedWorkflowInput,
  },
  save_nook_preference: {
    version: "1",
    riskClass: 1,
    externalEffect: false,
    reversible: true,
    requiresApproval: true,
    permissionLabel: "Change one reversible Nook behavior setting",
    inputSchema: preferenceInput,
  },
  search_web: {
    version: "1",
    riskClass: 0,
    externalEffect: false,
    reversible: true,
    requiresApproval: false,
    permissionLabel: "Search approved public web sources",
    inputSchema: searchInput,
  },
  summarize_sources: {
    version: "1",
    riskClass: 0,
    externalEffect: false,
    reversible: true,
    requiresApproval: false,
    permissionLabel: "Summarize saved research sources",
    inputSchema: summarizeInput,
  },
  propose_memory: {
    version: "1",
    riskClass: 0,
    externalEffect: false,
    reversible: true,
    requiresApproval: false,
    permissionLabel: "Propose a memory for user review",
    inputSchema: proposalInput,
  },
  browser_tab: {
    version: "1",
    riskClass: 1,
    externalEffect: false,
    reversible: true,
    requiresApproval: false,
    permissionLabel: "Open one allowlisted provider page in a new browser tab",
    inputSchema: browserTabInput,
  },
} satisfies Record<SafeToolName, ToolDefinition>);

export function getSafeTool(name: string) {
  if (!Object.prototype.hasOwnProperty.call(SAFE_TOOL_REGISTRY, name))
    throw new TypeError(`Unknown or disabled tool: ${name}`);
  return SAFE_TOOL_REGISTRY[name as SafeToolName];
}

export function parseToolInput(
  name: SafeToolName,
  value: unknown,
): Record<string, unknown> {
  return getSafeTool(name).inputSchema.parse(value) as Record<string, unknown>;
}

function inferPreference(input: string): Record<string, unknown> | null {
  if (
    !/\b(?:nook|pet|assistant|behavior|preference|working style)\b/i.test(input)
  )
    return null;
  if (/\b(?:more proactive|be proactive|take more initiative)\b/i.test(input))
    return { field: "initiative", value: "proactive" };
  if (/\b(?:less proactive|low initiative|ask me first)\b/i.test(input))
    return { field: "initiative", value: "low" };
  if (/\b(?:balanced initiative|stay balanced)\b/i.test(input))
    return { field: "initiative", value: "balanced" };
  if (/\b(?:brief|concise|shorter explanations?)\b/i.test(input))
    return { field: "explanationDepth", value: "brief" };
  if (/\b(?:deep|detailed|more explanation)\b/i.test(input))
    return { field: "explanationDepth", value: "deep" };
  if (/\b(?:quiet updates?|fewer updates?)\b/i.test(input))
    return { field: "updateFrequency", value: "quiet" };
  if (/\b(?:frequent updates?|more updates?)\b/i.test(input))
    return { field: "updateFrequency", value: "frequent" };
  return null;
}

function selectTool(
  input: string,
  proposed: TaskPlan,
): {
  name: SafeToolName;
  input: Record<string, unknown>;
  title: string;
  detail: string;
} {
  const preference = inferPreference(input);
  if (preference)
    return {
      name: "save_nook_preference",
      input: preference,
      title: "Review one Nook behavior change",
      detail:
        "Nook will change only the named reversible setting after your approval.",
    };
  const browserTask = parseBrowserTask(input);
  if (browserTask)
    return {
      name: "browser_tab",
      input: browserTask,
      title:
        browserTask.action === "search_provider"
          ? `Open ${browserTask.provider} search in a new tab`
          : `Open ${browserTask.provider} in a new tab`,
      detail:
        "Nook Browser Hand will execute one hash-bound tab command and return a signed device receipt. It cannot read passwords, cookies, or page contents.",
    };
  if (
    /\b(?:research|latest|newest|current|recent|look up|find sources?)\b/i.test(
      input,
    )
  )
    return {
      name: "search_web",
      input: {
        query: input,
        freshness: /\b(?:latest|newest|current|today)\b/i.test(input)
          ? "current"
          : "recent",
        maxResults: 5,
      },
      title: "Search approved public sources",
      detail:
        "Nook will query the approved search provider, validate URLs, and save source metadata. It will not fetch arbitrary private addresses.",
    };
  if (
    /\bfacebook\b/i.test(input) &&
    /\b(?:page|business|setup|create|register)\b/i.test(input)
  )
    return {
      name: "guided_workflow",
      input: { workflowId: "facebook_page_setup", request: input },
      title: "Prepare a Facebook Page setup guide",
      detail:
        "Nook will identify missing business details and stop before any external submission.",
    };
  if (/\bopen\b/i.test(input) && /\bfacebook\b/i.test(input))
    return {
      name: "open_supported_url",
      input: { destination: "facebook_pages" },
      title: "Prepare the Facebook Pages link",
      detail:
        "Nook will show a fixed supported link; you decide whether to open it.",
    };
  const artifactType = /\bpost|caption|social\b/i.test(input)
    ? "social_post"
    : /\bchecklist\b/i.test(input)
      ? "checklist"
      : /\boutline|plan\b/i.test(input)
        ? "outline"
        : /\bpage|landing|website\b/i.test(input)
          ? "page_copy"
          : "general";
  return {
    name: "create_draft",
    input: {
      artifactType,
      title: proposed.summary.slice(0, 100),
      instructions: input,
    },
    title: "Create and verify a saved draft",
    detail:
      "Nook will produce a local deliverable, verify it, and save a receipt. Nothing is sent or published.",
  };
}

/** Models propose the wording; this deterministic compiler alone grants a tool. */
export function compileSafePlan(input: string, proposed: TaskPlan): TaskPlan {
  if (proposed.blocked)
    return { ...proposed, steps: [], requiresApproval: false };
  const understanding = interpretRequest(input);
  if (
    understanding.needsClarification &&
    (understanding.intent === "browser_open" ||
      understanding.intent === "browser_search")
  )
    return {
      ...proposed,
      userMessage: understanding.understood,
      riskClass: 0,
      requiresApproval: false,
      blocked: true,
      blockedReason:
        understanding.clarification ||
        "Nook needs one browser detail before it can compile an action.",
      steps: [],
    };
  const selected = selectTool(input, proposed);
  const mixedResearchDraft =
    /\b(?:research|latest|newest|current|recent|look up|find sources?)\b/i.test(
      input,
    ) && /\b(?:draft|write|description|bio|caption|prepare)\b/i.test(input);
  if (mixedResearchDraft) {
    const search = getSafeTool("search_web"),
      summary = getSafeTool("summarize_sources"),
      draft = getSafeTool("create_draft");
    return {
      ...proposed,
      riskClass: 0,
      requiresApproval: false,
      blocked: false,
      blockedReason: "",
      steps: [
        {
          id: "step_1",
          title: "Find current authoritative sources",
          detail:
            "Search the approved provider and save validated source metadata.",
          kind: "research",
          mode: "tool",
          toolName: "search_web",
          toolVersion: search.version,
          toolInput: parseToolInput("search_web", {
            query: input,
            freshness: "current",
            maxResults: 5,
          }),
          riskClass: 0,
          externalEffect: false,
          requiresApproval: false,
          dependsOnStepId: null,
        },
        {
          id: "step_2",
          title: "Compare the saved evidence",
          detail: "Synthesize only claims supported by the saved source set.",
          kind: "research",
          mode: "tool",
          toolName: "summarize_sources",
          toolVersion: summary.version,
          toolInput: parseToolInput("summarize_sources", {
            sourceStepId: "step_1",
            instruction:
              "Summarize verified requirements, dates, and uncertainty with citations.",
          }),
          riskClass: 0,
          externalEffect: false,
          requiresApproval: false,
          dependsOnStepId: "step_1",
        },
        {
          id: "step_3",
          title: "Prepare the requested draft",
          detail:
            "Create the draft from user facts and verified evidence without publishing.",
          kind: "draft",
          mode: "tool",
          toolName: "create_draft",
          toolVersion: draft.version,
          toolInput: parseToolInput("create_draft", {
            artifactType: "general",
            title: proposed.summary.slice(0, 100),
            instructions: input,
          }),
          riskClass: 0,
          externalEffect: false,
          requiresApproval: false,
          dependsOnStepId: "step_2",
        },
      ],
    };
  }
  const definition = getSafeTool(selected.name);
  const toolInput = parseToolInput(selected.name, selected.input);
  return {
    ...proposed,
    riskClass: definition.riskClass,
    requiresApproval: definition.requiresApproval,
    blocked: false,
    blockedReason: "",
    steps: [
      {
        id: "step_1",
        title: selected.title,
        detail: selected.detail,
        kind:
          selected.name === "create_draft"
            ? "draft"
            : selected.name === "open_supported_url" ||
                selected.name === "browser_tab"
              ? "open_link"
              : "explain",
        mode: "tool",
        toolName: selected.name,
        toolVersion: definition.version,
        toolInput,
        riskClass: definition.riskClass,
        externalEffect: definition.externalEffect,
        requiresApproval: definition.requiresApproval,
      },
    ],
  };
}

export function deterministicToolOutput(
  name: Exclude<
    SafeToolName,
    | "create_draft"
    | "search_web"
    | "summarize_sources"
    | "propose_memory"
    | "browser_tab"
  >,
  input: Record<string, unknown>,
) {
  if (name === "open_supported_url") {
    const urls = {
      facebook_pages: "https://www.facebook.com/pages/create",
      linkedin: "https://www.linkedin.com/company/setup/new/",
      google_docs: "https://docs.google.com/document/u/0/",
    } as const;
    const destination = input.destination as keyof typeof urls;
    return {
      title: "Supported link prepared",
      summary: "Nook prepared a fixed link for you to open deliberately.",
      resultMarkdown: `[Open ${destination.replaceAll("_", " ")}](${urls[destination]})\n\nNook did not open the page or submit anything.`,
      whatChanged: [
        "Prepared a fixed HTTPS destination",
        "Kept navigation under your control",
      ],
      nextSuggestedAction:
        "Open the link only if you want to continue in that service.",
    };
  }
  if (name === "guided_workflow") {
    return {
      title: "Facebook Page setup worksheet",
      summary:
        "A guided, non-submitting Facebook Page setup checklist is ready.",
      resultMarkdown: [
        "## Details still needed",
        "- Page name",
        "- Business category",
        "- Short bio",
        "- Contact details you choose to publish",
        "- Profile and cover artwork",
        "",
        "## Safe workflow",
        "1. Confirm the details above.",
        "2. Open Facebook Pages yourself.",
        "3. Review every field before submission.",
        "4. Publish only when the account owner is satisfied.",
        "",
        "Nook has not accessed Facebook, created an account, or submitted a Page.",
      ].join("\n"),
      whatChanged: [
        "Prepared a versioned setup checklist",
        "Marked missing information instead of inventing it",
      ],
      nextSuggestedAction:
        "Provide the Page name, category, and bio to turn this into ready-to-paste copy.",
    };
  }
  const field = String(input.field);
  const value = String(input.value);
  return {
    title: "Nook preference updated",
    summary: `Nook changed ${field} to ${value} after approval.`,
    resultMarkdown: `## Preference receipt\n\n- Setting: **${field}**\n- New value: **${value}**\n- Scope: this Nook only\n- Reversible: yes`,
    whatChanged: [`Set ${field} to ${value}`, "Verified the saved value"],
    nextSuggestedAction:
      "Try a new task and adjust the setting again if the behavior is not right.",
  };
}
