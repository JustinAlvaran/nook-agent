import OpenAI from "openai";
import type { TaskPlan } from "./contracts";
import { enforcePolicy } from "./policy";

const taskPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "userMessage", "riskClass", "requiresApproval", "blocked", "blockedReason", "steps"],
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 180 },
    userMessage: { type: "string", minLength: 1, maxLength: 280 },
    riskClass: { type: "integer", enum: [0, 1, 2, 3] },
    requiresApproval: { type: "boolean" },
    blocked: { type: "boolean" },
    blockedReason: { type: "string", maxLength: 280 },
    steps: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "detail", "kind", "requiresApproval"],
        properties: {
          id: { type: "string" },
          title: { type: "string", minLength: 1, maxLength: 90 },
          detail: { type: "string", minLength: 1, maxLength: 180 },
          kind: { type: "string", enum: ["explain", "research", "draft", "open_link", "external_effect"] },
          requiresApproval: { type: "boolean" },
        },
      },
    },
  },
} as const;

export class MissingOpenAIKeyError extends Error {}

export async function createTaskPlan(input: string): Promise<TaskPlan> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new MissingOpenAIKeyError("OPENAI_API_KEY is not configured");

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    store: false,
    reasoning: { effort: "low" },
    max_output_tokens: 1800,
    instructions: [
      "You are Nook, a supervised desktop-companion planner.",
      "Create a short, honest plan. You do not execute actions and must never claim that you opened, read, changed, submitted, or published anything.",
      "Prefer official provider APIs and guided links. Passwords, payment details, cookies, and recovery codes must remain on the provider page.",
      "Risk 0 is explain/research/draft. Risk 1 is reversible app state. Risk 2 is messages/posts/files/forms. Risk 3 is purchases/deletion/publishing/permissions/account changes.",
      "Any external effect requires approval. Personal Facebook account registration is never automated; Page setup is guided or uses an approved Meta integration.",
    ].join("\n"),
    input,
    text: {
      format: {
        type: "json_schema",
        name: "nook_task_plan",
        strict: true,
        schema: taskPlanSchema,
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as TaskPlan;
  return enforcePolicy(input, parsed);
}
