import type { Model } from "@openai/agents";
import { OpenAIProvider } from "@openai/agents-openai";
import OpenAI from "openai";

export type ModelSource = "openai" | "openrouter";
export type ResolvedAgentModel = { model: string | Model; modelName: string; source: ModelSource };

export async function resolveAgentModel(purpose: "quality" | "economy" = "quality"): Promise<ResolvedAgentModel> {
  const routerKey = process.env.OPENROUTER_API_KEY;
  const routerModel = process.env.OPENROUTER_CHAT_MODEL;
  if (purpose === "economy" && routerKey && routerModel) {
    const client = new OpenAI({
      apiKey: routerKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://nook-desktop-pet.cookiewapo3.chatgpt.site",
        "X-Title": process.env.OPENROUTER_SITE_NAME || "Nook Agent",
      },
    });
    const provider = new OpenAIProvider({ openAIClient: client, useResponses: false, strictFeatureValidation: false });
    return { model: await provider.getModel(routerModel), modelName: routerModel, source: "openrouter" };
  }
  return { model: process.env.OPENAI_MODEL || "gpt-5.4-mini", modelName: process.env.OPENAI_MODEL || "gpt-5.4-mini", source: "openai" };
}
