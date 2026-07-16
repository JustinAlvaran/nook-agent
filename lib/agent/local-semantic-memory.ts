"use client";

import type {
  FeatureExtractionPipeline,
  ProgressInfo,
} from "@huggingface/transformers";
import { SEMANTIC_CAPABILITIES, type SemanticIntent } from "./semantic-brain";

export const LOCAL_MEMORY_MODEL =
  "Xenova/all-MiniLM-L6-v2" as const;

type Runtime = "webgpu" | "wasm";
type ApprovedMemory = { id: string; content: string };
export type LocalMemoryMatch = {
  id: string;
  score: number;
};
export type LocalSemanticResult = {
  model: typeof LOCAL_MEMORY_MODEL;
  runtime: Runtime;
  matches: LocalMemoryMatch[];
};
export type LocalCapabilityMatch = {
  id: Exclude<SemanticIntent, "unknown">;
  label: string;
  score: number;
};
export type LocalNookContextResult = LocalSemanticResult & {
  capabilities: LocalCapabilityMatch[];
};

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let activeRuntime: Runtime = "wasm";

function progressPercent(info: ProgressInfo) {
  if (info.status === "progress" || info.status === "progress_total")
    return Math.max(0, Math.min(100, Math.round(info.progress)));
  if (info.status === "ready") return 100;
  return null;
}

async function createExtractor(
  onProgress?: (percent: number | null) => void,
): Promise<FeatureExtractionPipeline> {
  const { pipeline } = await import("@huggingface/transformers");
  const progress_callback = (info: ProgressInfo) =>
    onProgress?.(progressPercent(info));
  const hasWebGpu =
    typeof navigator !== "undefined" && "gpu" in navigator;
  if (hasWebGpu) {
    try {
      const extractor = await pipeline(
        "feature-extraction",
        LOCAL_MEMORY_MODEL,
        { device: "webgpu", dtype: "q4", progress_callback },
      );
      activeRuntime = "webgpu";
      return extractor;
    } catch {
      // WebGPU remains uneven across browsers; the cached model can fall back
      // to the portable WASM runtime without changing Nook's trust boundary.
    }
  }
  activeRuntime = "wasm";
  return pipeline("feature-extraction", LOCAL_MEMORY_MODEL, {
    dtype: "q8",
    progress_callback,
  });
}

function getExtractor(onProgress?: (percent: number | null) => void) {
  if (!extractorPromise)
    extractorPromise = createExtractor(onProgress).catch((error) => {
      extractorPromise = null;
      throw error;
    });
  return extractorPromise;
}

function dot(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1)
    score += left[index] * right[index];
  return score;
}

/**
 * Ranks only already-approved memory. Text stays in this browser; the hosted
 * app receives neither embeddings nor memory content from this operation.
 */
export async function rankApprovedMemoryLocally(args: {
  request: string;
  memories: ApprovedMemory[];
  onProgress?: (percent: number | null) => void;
}): Promise<LocalSemanticResult> {
  const memories = args.memories
    .filter((memory) => memory.id && memory.content.trim())
    .slice(0, 20);
  const extractor = await getExtractor(args.onProgress);
  if (!memories.length)
    return { model: LOCAL_MEMORY_MODEL, runtime: activeRuntime, matches: [] };
  const tensor = await extractor(
    [args.request.slice(0, 500), ...memories.map((memory) => memory.content.slice(0, 500))],
    { pooling: "mean", normalize: true },
  );
  const rows = tensor.tolist() as number[][];
  const requestEmbedding = rows[0] ?? [];
  const matches = memories
    .map((memory, index) => ({
      id: memory.id,
      score: dot(requestEmbedding, rows[index + 1] ?? []),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  return {
    model: LOCAL_MEMORY_MODEL,
    runtime: activeRuntime,
    matches,
  };
}

/**
 * One private, in-browser retrieval pass over both approved user memory and
 * Nook's versioned ability cards. This is the RAG layer: it retrieves context
 * for understanding, but does not emit tool inputs or grant permission.
 */
export async function retrieveNookContextLocally(args: {
  request: string;
  memories: ApprovedMemory[];
  onProgress?: (percent: number | null) => void;
}): Promise<LocalNookContextResult> {
  const memories = args.memories
    .filter((memory) => memory.id && memory.content.trim())
    .slice(0, 20);
  const abilityCards = SEMANTIC_CAPABILITIES.map((capability) =>
    [capability.label, ...capability.phrases, ...capability.tokens].join(". "),
  );
  const extractor = await getExtractor(args.onProgress);
  const tensor = await extractor(
    [
      args.request.slice(0, 500),
      ...abilityCards,
      ...memories.map((memory) => memory.content.slice(0, 500)),
    ],
    { pooling: "mean", normalize: true },
  );
  const rows = tensor.tolist() as number[][];
  const requestEmbedding = rows[0] ?? [];
  const capabilityOffset = 1;
  const memoryOffset = capabilityOffset + abilityCards.length;
  const capabilities = SEMANTIC_CAPABILITIES.map((capability, index) => ({
    id: capability.id,
    label: capability.label,
    score: dot(requestEmbedding, rows[capabilityOffset + index] ?? []),
  }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const matches = memories
    .map((memory, index) => ({
      id: memory.id,
      score: dot(requestEmbedding, rows[memoryOffset + index] ?? []),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  return {
    model: LOCAL_MEMORY_MODEL,
    runtime: activeRuntime,
    matches,
    capabilities,
  };
}
