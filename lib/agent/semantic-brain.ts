import { parseBrowserTask, type BrowserProvider } from "../browser/commands";

export type SemanticIntent =
  | "browser_search"
  | "browser_open"
  | "research"
  | "draft"
  | "teach_preference"
  | "guided_workflow"
  | "unknown";

export type SemanticCapability = {
  id: Exclude<SemanticIntent, "unknown">;
  label: string;
  score: number;
};

export type SemanticInterpretation = {
  intent: SemanticIntent;
  label: string;
  confidence: "high" | "medium" | "low";
  method: "grammar" | "semantic" | "none";
  provider: BrowserProvider | null;
  query: string | null;
  understood: string;
  needsClarification: boolean;
  clarification: string | null;
  retrievedCapabilities: SemanticCapability[];
  guardrail: string;
};

type CapabilityPrototype = {
  id: Exclude<SemanticIntent, "unknown">;
  label: string;
  phrases: string[];
  tokens: string[];
};

/**
 * This is Nook's tiny, inspectable ability index. It acts like retrieval over
 * semantic prototypes: user language retrieves known abilities, never new
 * tools or permission. An optional local embedding model can improve ranking,
 * but the deterministic compiler remains authoritative.
 */
export const SEMANTIC_CAPABILITIES: readonly CapabilityPrototype[] = [
  {
    id: "browser_search",
    label: "Open a browser search",
    phrases: ["search for", "look up", "find on", "new tab"],
    tokens: ["search", "find", "lookup", "browser", "tab", "youtube", "google", "wikipedia", "github"],
  },
  {
    id: "browser_open",
    label: "Open a supported site",
    phrases: ["open youtube", "go to google", "launch github", "new tab"],
    tokens: ["open", "launch", "visit", "browser", "tab", "site", "youtube", "google", "wikipedia", "github"],
  },
  {
    id: "research",
    label: "Research with sources",
    phrases: ["research", "find sources", "current guidance", "compare evidence"],
    tokens: ["research", "sources", "evidence", "compare", "current", "latest", "investigate", "citations"],
  },
  {
    id: "draft",
    label: "Create a draft",
    phrases: ["write a", "draft a", "make an outline", "rewrite this"],
    tokens: ["write", "draft", "rewrite", "compose", "outline", "caption", "copy", "checklist"],
  },
  {
    id: "teach_preference",
    label: "Teach Nook a preference",
    phrases: ["remember that", "i prefer", "teach you", "working preference"],
    tokens: ["remember", "prefer", "preference", "teach", "always", "concise", "detailed"],
  },
  {
    id: "guided_workflow",
    label: "Guide a workflow",
    phrases: ["guide me", "walk me through", "step by step", "help me set up"],
    tokens: ["guide", "walkthrough", "steps", "setup", "workflow", "how", "facebook", "page"],
  },
] as const;

const providerAliases: Array<[RegExp, BrowserProvider]> = [
  [/\b(?:youtube|you\s*tube|yt|youtub)\b/i, "youtube"],
  [/\b(?:google|googl)\b/i, "google"],
  [/\b(?:bing)\b/i, "bing"],
  [/\b(?:wikipedia|wiki|wikipdia)\b/i, "wikipedia"],
  [/\b(?:github|git\s*hub)\b/i, "github"],
];

const unsupportedBrowserEffect =
  /\b(?:then|and then|after that)\s+(?:click|watch|play|open|select|choose|follow|like|comment|subscribe|sign\s*in|log\s*in|submit|download|upload|buy|pay|delete|type|fill|press|view)\b/i;

function normalize(input: string) {
  return input
    .toLowerCase()
    .replace(/you\s*tube/g, "youtube")
    .replace(/git\s*hub/g, "github")
    .replace(/look\s+up/g, "lookup")
    .replace(/walk\s+me\s+through/g, "walkthrough")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capabilityScore(input: string, prototype: CapabilityPrototype) {
  const normalized = normalize(input);
  const words = new Set(normalized.split(" ").filter(Boolean));
  const tokenHits = prototype.tokens.filter((token) => words.has(token)).length;
  const phraseHits = prototype.phrases.filter((phrase) =>
    normalized.includes(normalize(phrase)),
  ).length;
  return Math.min(1, tokenHits * 0.14 + phraseHits * 0.34);
}

function retrieveCapabilities(input: string) {
  return SEMANTIC_CAPABILITIES.map((capability) => ({
    id: capability.id,
    label: capability.label,
    score: capabilityScore(input, capability),
  }))
    .filter((capability) => capability.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function providerFrom(input: string) {
  return providerAliases.find(([pattern]) => pattern.test(input))?.[1] ?? null;
}

function likelySearchQuery(input: string) {
  const provider = "(?:youtube|you\\s*tube|yt|youtub|google|googl|bing|wikipedia|wiki|wikipdia|github|git\\s*hub)";
  const patterns = [
    new RegExp(`\\b(?:search|look\\s+up)\\s+(?:on\\s+)?${provider}\\s+(?:for\\s+)?(.+)$`, "i"),
    new RegExp(`\\b(?:search|look\\s+up)\\s+(?:for\\s+)?(.+?)\\s+(?:on|using)\\s+${provider}\\s*$`, "i"),
    new RegExp(`\\bfind\\s+(.+?)\\s+(?:on|using)\\s+${provider}\\s*$`, "i"),
    /\b(?:search|look\s+up|find)\s+(?:for\s+)?(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    const query = match?.[1]?.replace(/[.!?]+$/g, "").trim().slice(0, 300);
    const providerOnly = new RegExp(`^${provider}(?:\\s+for)?$`, "i");
    if (query && query.toLowerCase() !== "for" && !providerOnly.test(query))
      return query;
  }
  return null;
}

export function interpretRequest(input: string): SemanticInterpretation {
  const normalized = input.replace(/\s+/g, " ").trim();
  const retrievedCapabilities = retrieveCapabilities(normalized);
  const browser = parseBrowserTask(normalized);
  if (browser) {
    const label = browser.action === "search_provider" ? "Browser search" : "Open site";
    return {
      intent: browser.action === "search_provider" ? "browser_search" : "browser_open",
      label,
      confidence: "high",
      method: "grammar",
      provider: browser.provider,
      query: browser.action === "search_provider" ? browser.query : null,
      understood:
        browser.action === "search_provider"
          ? `Search ${browser.provider} for “${browser.query}” in a new tab.`
          : `Open ${browser.provider} in a new tab.`,
      needsClarification: false,
      clarification: null,
      retrievedCapabilities,
      guardrail: "Only the allowlisted destination can open; page clicks and account actions are excluded.",
    };
  }

  const provider = providerFrom(normalized);
  const browserLanguage =
    /\b(?:open|launch|visit|new\s+tab|browser|search|look\s+up|find)\b/i.test(normalized);
  if (browserLanguage && unsupportedBrowserEffect.test(normalized)) {
    return {
      intent: "browser_search",
      label: "Browser request",
      confidence: "high",
      method: "semantic",
      provider,
      query: likelySearchQuery(normalized),
      understood: "Open or search is safe, but the requested follow-up page action is not supported yet.",
      needsClarification: true,
      clarification: "Remove the click/watch/follow-up step, or ask Nook to open only the search results.",
      retrievedCapabilities,
      guardrail: "Nook will not silently turn a search into page control.",
    };
  }
  if (browserLanguage && /\b(?:search|look\s+up|find)\b/i.test(normalized)) {
    const query = likelySearchQuery(normalized);
    const missing = !provider ? "Which site should I search: YouTube, Google, Bing, Wikipedia, or GitHub?" : !query ? "What should I search for?" : null;
    return {
      intent: "browser_search",
      label: "Browser search",
      confidence: missing ? "medium" : "high",
      method: "semantic",
      provider,
      query,
      understood: provider && query ? `Search ${provider} for “${query}” in a new tab.` : "You want Nook to open a browser search.",
      needsClarification: Boolean(missing),
      clarification: missing,
      retrievedCapabilities,
      guardrail: "A browser action is compiled only after the site and search words are explicit.",
    };
  }
  if (browserLanguage && /\b(?:open|launch|visit|new\s+tab|browser)\b/i.test(normalized)) {
    const missing = !provider ? "Which supported site should I open?" : null;
    return {
      intent: "browser_open",
      label: "Open site",
      confidence: missing ? "medium" : "high",
      method: "semantic",
      provider,
      query: null,
      understood: provider ? `Open ${provider} in a new tab.` : "You want Nook to open a site in a new tab.",
      needsClarification: Boolean(missing),
      clarification: missing,
      retrievedCapabilities,
      guardrail: "Nook accepts only a small list of known public destinations.",
    };
  }

  const first = retrievedCapabilities[0];
  const second = retrievedCapabilities[1];
  const margin = (first?.score ?? 0) - (second?.score ?? 0);
  const intent = first && first.score >= 0.28 ? first.id : "unknown";
  const lowSeparation = Boolean(first && second && margin < 0.1);
  const vagueReference = /\b(?:this|that|it|something)\b/i.test(normalized) && normalized.split(" ").length < 8;
  const needsClarification = !normalized || intent === "unknown" || lowSeparation || vagueReference;
  const confidence = !first || first.score < 0.28 ? "low" : first.score >= 0.62 && !lowSeparation ? "high" : "medium";
  return {
    intent,
    label: first?.label ?? "Needs direction",
    confidence,
    method: intent === "unknown" ? "none" : "semantic",
    provider: null,
    query: null,
    understood: needsClarification
      ? "Nook found more than one possible meaning and will not guess."
      : `Use the “${first.label}” ability.`,
    needsClarification,
    clarification: !normalized
      ? null
      : vagueReference
        ? "What does “this/that/it” refer to?"
        : lowSeparation
          ? `Do you want to ${first.label.toLowerCase()} or ${second.label.toLowerCase()}?`
          : intent === "unknown"
            ? "What outcome do you want Nook to produce?"
            : null,
    retrievedCapabilities,
    guardrail: "Retrieved abilities and memories provide context; they never grant a tool or permission.",
  };
}
