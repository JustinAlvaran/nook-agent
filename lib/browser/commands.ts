export const BROWSER_COMMAND_VERSION = "nook-browser-command@1" as const;

export const BROWSER_PROVIDERS = {
  youtube: {
    label: "YouTube",
    home: "https://www.youtube.com/",
    search: "https://www.youtube.com/results?search_query=",
  },
  google: {
    label: "Google",
    home: "https://www.google.com/",
    search: "https://www.google.com/search?q=",
  },
  bing: {
    label: "Bing",
    home: "https://www.bing.com/",
    search: "https://www.bing.com/search?q=",
  },
  wikipedia: {
    label: "Wikipedia",
    home: "https://en.wikipedia.org/",
    search: "https://en.wikipedia.org/w/index.php?search=",
  },
  github: {
    label: "GitHub",
    home: "https://github.com/",
    search: "https://github.com/search?type=repositories&q=",
  },
} as const;

export type BrowserProvider = keyof typeof BROWSER_PROVIDERS;

export type BrowserToolInput =
  | {
      action: "open_provider";
      provider: BrowserProvider;
      disposition: "new_tab";
    }
  | {
      action: "search_provider";
      provider: BrowserProvider;
      query: string;
      disposition: "new_tab";
    };

export type BrowserCommand = {
  version: typeof BROWSER_COMMAND_VERSION;
  id: string;
  taskId: string;
  actionHash: string;
  expiresAt: string;
  action: BrowserToolInput & { url: string };
};

const providerPattern = "youtube|google|bing|wikipedia|github";
const unsupportedContinuation =
  /\b(?:and|then)\s+(?:click|play|like|comment|subscribe|sign\s*in|log\s*in|submit|download|upload|buy|pay|delete|type|fill)\b/i;

function cleanQuery(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim()
    .slice(0, 300);
}

/**
 * Compiles only the intentionally small navigation grammar Nook can verify.
 * It never turns model text into selectors, JavaScript, or an arbitrary URL.
 */
export function parseBrowserTask(input: string): BrowserToolInput | null {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized || unsupportedContinuation.test(normalized)) return null;

  // Accept the way people naturally ask for this, including phrases such as
  // "open a new tab and search YouTube then search for cat videos".
  const mentionedProvider = normalized.match(
    new RegExp(`\\b(${providerPattern})(?:\\.com)?\\b`, "i"),
  )?.[1]?.toLowerCase() as BrowserProvider | undefined;
  const naturalQuery = normalized.match(
    /\b(?:search\s+for|look\s+up)\s+(.+)$/i,
  )?.[1];
  if (
    mentionedProvider &&
    mentionedProvider in BROWSER_PROVIDERS &&
    naturalQuery &&
    /\b(?:open|launch|go\s+to|new\s+tab)\b/i.test(normalized)
  ) {
    return {
      action: "search_provider",
      provider: mentionedProvider,
      query: cleanQuery(naturalQuery),
      disposition: "new_tab",
    };
  }

  const searchPatterns = [
    new RegExp(
      `\\b(?:open|launch|go\\s+to)\\s+(?:a\\s+new\\s+tab\\s+(?:for|with)\\s+)?(${providerPattern})(?:\\s+(?:and|then))?\\s+(?:search(?:\\s+for)?|look\\s+up)\\s+(.+)$`,
      "i",
    ),
    new RegExp(
      `\\b(?:search|look\\s+up)\\s+(?:on\\s+)?(${providerPattern})\\s+(?:for\\s+)?(.+)$`,
      "i",
    ),
  ];
  for (const pattern of searchPatterns) {
    const match = normalized.match(pattern);
    const provider = match?.[1]?.toLowerCase() as BrowserProvider | undefined;
    const query = match?.[2] ? cleanQuery(match[2]) : "";
    if (provider && provider in BROWSER_PROVIDERS && query)
      return {
        action: "search_provider",
        provider,
        query,
        disposition: "new_tab",
      };
  }

  const open = normalized.match(
    new RegExp(
      `\\b(?:open|launch|go\\s+to)\\s+(?:a\\s+new\\s+tab\\s+(?:for|with)\\s+)?(${providerPattern})(?:\\.com)?\\s*$`,
      "i",
    ),
  );
  const provider = open?.[1]?.toLowerCase() as BrowserProvider | undefined;
  return provider && provider in BROWSER_PROVIDERS
    ? { action: "open_provider", provider, disposition: "new_tab" }
    : null;
}

export function browserActionUrl(input: BrowserToolInput) {
  const provider = BROWSER_PROVIDERS[input.provider];
  return input.action === "search_provider"
    ? `${provider.search}${encodeURIComponent(input.query)}`
    : provider.home;
}

export function browserActionLabel(input: BrowserToolInput) {
  const label = BROWSER_PROVIDERS[input.provider].label;
  return input.action === "search_provider"
    ? `Search ${label} for “${input.query}”`
    : `Open ${label}`;
}

export function createBrowserCommand(args: {
  id: string;
  taskId: string;
  actionHash: string;
  expiresAt: string;
  input: BrowserToolInput;
}): BrowserCommand {
  return {
    version: BROWSER_COMMAND_VERSION,
    id: args.id,
    taskId: args.taskId,
    actionHash: args.actionHash,
    expiresAt: args.expiresAt,
    action: { ...args.input, url: browserActionUrl(args.input) },
  };
}

