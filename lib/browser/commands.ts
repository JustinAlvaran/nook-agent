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

const providerPattern =
  "youtube|you\\s*tube|yt|youtub|google|googl|bing|wikipedia|wiki|wikipdia|github|git\\s*hub";
const unsupportedContinuation =
  /\b(?:(?:and\s+)?then|and|after\s+that)\s+(?:click|watch|play|open|select|choose|follow|view|press|like|comment|subscribe|sign\s*in|log\s*in|submit|download|upload|buy|pay|delete|type|fill)\b/i;

function resolveProvider(value: string | undefined): BrowserProvider | null {
  const normalized = value?.toLowerCase().replace(/\s+/g, "") ?? "";
  if (["youtube", "yt", "youtub"].includes(normalized)) return "youtube";
  if (["google", "googl"].includes(normalized)) return "google";
  if (normalized === "bing") return "bing";
  if (["wikipedia", "wiki", "wikipdia"].includes(normalized))
    return "wikipedia";
  if (normalized === "github") return "github";
  return null;
}

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
  const mentionedProvider = resolveProvider(normalized.match(
    new RegExp(`\\b(${providerPattern})(?:\\.com)?\\b`, "i"),
  )?.[1]);
  const naturalQuery = normalized.match(
    /\b(?:search\s+for|look\s+up)\s+(.+)$/i,
  )?.[1];
  if (
    mentionedProvider &&
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
      `\\b(?:open|launch|go\\s+to|take\\s+me\\s+to|pull\\s+up)\\s+(?:a\\s+new\\s+tab\\s+(?:for|with)\\s+)?(${providerPattern})(?:\\s+(?:and|then))?\\s+(?:search(?:\\s+for)?|look\\s+up|find)\\s+(.+)$`,
      "i",
    ),
    new RegExp(
      `\\b(?:search|look\\s+up|find)\\s+(?:on\\s+)?(${providerPattern})\\s+(?:for\\s+)?(.+)$`,
      "i",
    ),
    new RegExp(
      `\\b(?:search(?:\\s+for)?|look\\s+up|find)\\s+(.+?)\\s+(?:on|using)\\s+(${providerPattern})\\s*$`,
      "i",
    ),
  ];
  for (const pattern of searchPatterns) {
    const match = normalized.match(pattern);
    const reversed = pattern === searchPatterns[2];
    const provider = resolveProvider(match?.[reversed ? 2 : 1]);
    const query = match?.[reversed ? 1 : 2]
      ? cleanQuery(match[reversed ? 1 : 2])
      : "";
    if (provider && query && query.toLowerCase() !== "for")
      return {
        action: "search_provider",
        provider,
        query,
        disposition: "new_tab",
      };
  }

  const open = normalized.match(
    new RegExp(
      `\\b(?:open|launch|go\\s+to|take\\s+me\\s+to|pull\\s+up)\\s+(?:a\\s+new\\s+tab\\s+(?:for|with)\\s+)?(${providerPattern})(?:\\.com)?\\s*$`,
      "i",
    ),
  );
  const provider = resolveProvider(open?.[1]);
  return provider
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

