import { z } from "zod";
import type { RiskClass, SafeToolName, TaskPlan } from "../contracts";

const draftInput = z.object({
  artifactType: z.enum(["page_copy", "social_post", "outline", "checklist", "general"]),
  title: z.string().min(1).max(100),
  instructions: z.string().min(1).max(1_200),
}).strict();

const supportedUrlInput = z.object({
  destination: z.enum(["facebook_pages", "linkedin", "google_docs"]),
}).strict();

const guidedWorkflowInput = z.object({
  workflowId: z.literal("facebook_page_setup"),
  request: z.string().min(1).max(1_200),
}).strict();

const preferenceInput = z.discriminatedUnion("field", [
  z.object({ field: z.literal("initiative"), value: z.enum(["low", "balanced", "proactive"]) }).strict(),
  z.object({ field: z.literal("explanationDepth"), value: z.enum(["brief", "clear", "deep"]) }).strict(),
  z.object({ field: z.literal("updateFrequency"), value: z.enum(["quiet", "milestones", "frequent"]) }).strict(),
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
    version: "1", riskClass: 0, externalEffect: false, reversible: true,
    requiresApproval: false, permissionLabel: "Save a draft inside Nook", inputSchema: draftInput,
  },
  open_supported_url: {
    version: "1", riskClass: 0, externalEffect: false, reversible: true,
    requiresApproval: false, permissionLabel: "Prepare a user-clickable supported link", inputSchema: supportedUrlInput,
  },
  guided_workflow: {
    version: "1", riskClass: 0, externalEffect: false, reversible: true,
    requiresApproval: false, permissionLabel: "Prepare a guided checklist inside Nook", inputSchema: guidedWorkflowInput,
  },
  save_nook_preference: {
    version: "1", riskClass: 1, externalEffect: false, reversible: true,
    requiresApproval: true, permissionLabel: "Change one reversible Nook behavior setting", inputSchema: preferenceInput,
  },
} satisfies Record<SafeToolName, ToolDefinition>);

export function getSafeTool(name: string) {
  if (!Object.prototype.hasOwnProperty.call(SAFE_TOOL_REGISTRY, name)) throw new TypeError(`Unknown or disabled tool: ${name}`);
  return SAFE_TOOL_REGISTRY[name as SafeToolName];
}

export function parseToolInput(name: SafeToolName, value: unknown): Record<string, unknown> {
  return getSafeTool(name).inputSchema.parse(value) as Record<string, unknown>;
}

function inferPreference(input: string): Record<string, unknown> | null {
  if (!/\b(?:nook|pet|assistant|behavior|preference|working style)\b/i.test(input)) return null;
  if (/\b(?:more proactive|be proactive|take more initiative)\b/i.test(input)) return { field: "initiative", value: "proactive" };
  if (/\b(?:less proactive|low initiative|ask me first)\b/i.test(input)) return { field: "initiative", value: "low" };
  if (/\b(?:balanced initiative|stay balanced)\b/i.test(input)) return { field: "initiative", value: "balanced" };
  if (/\b(?:brief|concise|shorter explanations?)\b/i.test(input)) return { field: "explanationDepth", value: "brief" };
  if (/\b(?:deep|detailed|more explanation)\b/i.test(input)) return { field: "explanationDepth", value: "deep" };
  if (/\b(?:quiet updates?|fewer updates?)\b/i.test(input)) return { field: "updateFrequency", value: "quiet" };
  if (/\b(?:frequent updates?|more updates?)\b/i.test(input)) return { field: "updateFrequency", value: "frequent" };
  return null;
}

function selectTool(input: string, proposed: TaskPlan): { name: SafeToolName; input: Record<string, unknown>; title: string; detail: string } {
  const preference = inferPreference(input);
  if (preference) return {
    name: "save_nook_preference", input: preference,
    title: "Review one Nook behavior change", detail: "Nook will change only the named reversible setting after your approval.",
  };
  if (/\bfacebook\b/i.test(input) && /\b(?:page|business|setup|create|register)\b/i.test(input)) return {
    name: "guided_workflow", input: { workflowId: "facebook_page_setup", request: input },
    title: "Prepare a Facebook Page setup guide", detail: "Nook will identify missing business details and stop before any external submission.",
  };
  if (/\bopen\b/i.test(input) && /\bfacebook\b/i.test(input)) return {
    name: "open_supported_url", input: { destination: "facebook_pages" },
    title: "Prepare the Facebook Pages link", detail: "Nook will show a fixed supported link; you decide whether to open it.",
  };
  const artifactType = /\bpost|caption|social\b/i.test(input) ? "social_post"
    : /\bchecklist\b/i.test(input) ? "checklist"
      : /\boutline|plan\b/i.test(input) ? "outline"
        : /\bpage|landing|website\b/i.test(input) ? "page_copy" : "general";
  return {
    name: "create_draft", input: { artifactType, title: proposed.summary.slice(0, 100), instructions: input },
    title: "Create and verify a saved draft", detail: "Nook will produce a local deliverable, verify it, and save a receipt. Nothing is sent or published.",
  };
}

/** Models propose the wording; this deterministic compiler alone grants a tool. */
export function compileSafePlan(input: string, proposed: TaskPlan): TaskPlan {
  if (proposed.blocked) return { ...proposed, steps: [], requiresApproval: false };
  const selected = selectTool(input, proposed);
  const definition = getSafeTool(selected.name);
  const toolInput = parseToolInput(selected.name, selected.input);
  return {
    ...proposed,
    riskClass: definition.riskClass,
    requiresApproval: definition.requiresApproval,
    blocked: false,
    blockedReason: "",
    steps: [{
      id: "step_1", title: selected.title, detail: selected.detail,
      kind: selected.name === "create_draft" ? "draft" : selected.name === "open_supported_url" ? "open_link" : "explain",
      mode: "tool", toolName: selected.name, toolVersion: definition.version, toolInput,
      riskClass: definition.riskClass, externalEffect: definition.externalEffect,
      requiresApproval: definition.requiresApproval,
    }],
  };
}

export function deterministicToolOutput(name: Exclude<SafeToolName, "create_draft">, input: Record<string, unknown>) {
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
      whatChanged: ["Prepared a fixed HTTPS destination", "Kept navigation under your control"],
      nextSuggestedAction: "Open the link only if you want to continue in that service.",
    };
  }
  if (name === "guided_workflow") {
    return {
      title: "Facebook Page setup worksheet",
      summary: "A guided, non-submitting Facebook Page setup checklist is ready.",
      resultMarkdown: [
        "## Details still needed", "- Page name", "- Business category", "- Short bio", "- Contact details you choose to publish", "- Profile and cover artwork", "",
        "## Safe workflow", "1. Confirm the details above.", "2. Open Facebook Pages yourself.", "3. Review every field before submission.", "4. Publish only when the account owner is satisfied.", "",
        "Nook has not accessed Facebook, created an account, or submitted a Page.",
      ].join("\n"),
      whatChanged: ["Prepared a versioned setup checklist", "Marked missing information instead of inventing it"],
      nextSuggestedAction: "Provide the Page name, category, and bio to turn this into ready-to-paste copy.",
    };
  }
  const field = String(input.field);
  const value = String(input.value);
  return {
    title: "Nook preference updated",
    summary: `Nook changed ${field} to ${value} after approval.`,
    resultMarkdown: `## Preference receipt\n\n- Setting: **${field}**\n- New value: **${value}**\n- Scope: this Nook only\n- Reversible: yes`,
    whatChanged: [`Set ${field} to ${value}`, "Verified the saved value"],
    nextSuggestedAction: "Try a new task and adjust the setting again if the behavior is not right.",
  };
}
