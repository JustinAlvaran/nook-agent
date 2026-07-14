export type SearchWebInput = {
  query: string;
  freshness: "any" | "recent" | "current";
  allowedDomains?: string[];
  blockedDomains?: string[];
  maxResults: number;
};
export type SearchResult = {
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string | null;
  retrievedAt: string;
  snippet: string;
};
export type SearchProvider =
  | "brave"
  | "openai_web_search"
  | "github_public_search";
export function isSafeResearchUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const h = url.hostname.toLowerCase();
    if (
      h === "localhost" ||
      h.endsWith(".local") ||
      h === "0.0.0.0" ||
      h === "::1"
    )
      return false;
    const parts = h.split(".").map(Number);
    if (parts.length === 4 && parts.every(Number.isInteger)) {
      if (
        parts[0] === 10 ||
        parts[0] === 127 ||
        parts[0] === 0 ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
function domainMatches(host: string, domain: string) {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return host === d || host.endsWith(`.${d}`);
}
export function normalizeSearchResults(
  raw: Array<{
    title?: unknown;
    url?: unknown;
    description?: unknown;
    page_age?: unknown;
  }>,
  input: SearchWebInput,
  now = new Date(),
): SearchResult[] {
  const seen = new Set<string>();
  const allowed = input.allowedDomains ?? [];
  const blocked = input.blockedDomains ?? [];
  const out: SearchResult[] = [];
  for (const item of raw) {
    const url = typeof item.url === "string" ? item.url : "";
    if (!isSafeResearchUrl(url)) continue;
    const parsed = new URL(url);
    if (
      allowed.length &&
      !allowed.some((d) => domainMatches(parsed.hostname, d))
    )
      continue;
    if (blocked.some((d) => domainMatches(parsed.hostname, d))) continue;
    const canonical = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push({
      title: String(item.title ?? parsed.hostname).slice(0, 300),
      url,
      sourceName: parsed.hostname.replace(/^www\./, ""),
      publishedAt:
        typeof item.page_age === "string" &&
        !Number.isNaN(Date.parse(item.page_age))
          ? new Date(item.page_age).toISOString()
          : null,
      retrievedAt: now.toISOString(),
      snippet: String(item.description ?? "").slice(0, 1000),
    });
    if (out.length >= Math.min(Math.max(input.maxResults, 1), 10)) break;
  }
  return out;
}
export async function researchContentHash(source: SearchResult) {
  const data = new TextEncoder().encode(
    `${source.url}\n${source.title}\n${source.snippet}`,
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function configuredSearchProvider() {
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  if (process.env.OPENAI_API_KEY) return "openai_web_search_or_github";
  return "github_public_search";
}

async function searchWithOpenAI(input: SearchWebInput) {
  if (!process.env.OPENAI_API_KEY)
    throw new Error("SEARCH_PROVIDER_NOT_CONFIGURED");
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const timeScope =
    input.freshness === "current"
      ? "Prioritize sources from the last seven days when the subject is time-sensitive."
      : input.freshness === "recent"
        ? "Prefer sources from the last month when the subject is time-sensitive."
        : "Use the most authoritative available sources regardless of date.";
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: [
      "Find authoritative public sources for the following research request.",
      `Request: ${input.query}`,
      timeScope,
      `Return a concise source-backed answer using no more than ${input.maxResults} distinct sources.`,
    ].join("\n"),
    tools: [
      {
        type: "web_search",
        search_context_size: "medium",
        ...(input.allowedDomains?.length
          ? { filters: { allowed_domains: input.allowedDomains } }
          : {}),
      },
    ],
    include: ["web_search_call.action.sources"],
  });
  const citations: Array<{
    title?: unknown;
    url?: unknown;
    description?: unknown;
  }> = [];
  const seen = new Set<string>();
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const content of item.content) {
      if (content.type !== "output_text") continue;
      for (const annotation of content.annotations) {
        if (annotation.type !== "url_citation" || seen.has(annotation.url))
          continue;
        seen.add(annotation.url);
        citations.push({
          title: annotation.title,
          url: annotation.url,
          description: content.text
            .slice(
              Math.max(0, annotation.start_index - 220),
              Math.min(content.text.length, annotation.end_index + 220),
            )
            .replace(/\s+/g, " ")
            .trim(),
        });
      }
    }
  }
  return citations;
}

async function searchWithGitHub(input: SearchWebInput) {
  type GitHubBody = {
    items?: Array<{
      full_name?: unknown;
      html_url?: unknown;
      description?: unknown;
      pushed_at?: unknown;
      stargazers_count?: unknown;
    }>;
  };
  const request = async (query: string) => {
    const endpoint = new URL("https://api.github.com/search/repositories");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("per_page", String(input.maxResults));
    endpoint.searchParams.set("sort", "stars");
    endpoint.searchParams.set("order", "desc");
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Nook-Agent",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`GITHUB_SEARCH_${response.status}`);
    return (await response.json()) as GitHubBody;
  };
  let body = await request(input.query);
  if (!(body.items ?? []).length) {
    const tokens =
      input.query.match(/[\p{L}\p{N}.+#-]+/gu)?.filter(
        (token) =>
          token.length > 2 &&
          !/^(?:the|and|for|with|from|research|find|latest|current|repository|github|architecture|character|scene|procedural)$/i.test(
            token,
          ),
      ) ?? [];
    const simplified = Array.from(
      new Set(tokens.length > 5 ? [tokens[0], ...tokens.slice(-4)] : tokens),
    ).join(" ");
    if (simplified && simplified !== input.query)
      body = await request(simplified);
  }
  return (body.items ?? []).map((item) => ({
    title: item.full_name,
    url: item.html_url,
    page_age: item.pushed_at,
    description: `${String(item.description ?? "Public GitHub repository")}. ${Number(item.stargazers_count ?? 0).toLocaleString()} stars.`,
  }));
}

export async function searchWebWithProvider(
  input: SearchWebInput,
): Promise<{ sources: SearchResult[]; provider: SearchProvider }> {
  if (
    input.query.trim().length < 1 ||
    input.query.length > 500 ||
    input.maxResults < 1 ||
    input.maxResults > 10
  )
    throw new Error("INVALID_SEARCH_INPUT");
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    if (process.env.OPENAI_API_KEY) {
      try {
        const raw = await searchWithOpenAI(input);
        const sources = normalizeSearchResults(raw, input);
        if (sources.length) return { sources, provider: "openai_web_search" };
      } catch {
        // A public, read-only GitHub search still keeps code and repository research usable.
      }
    }
    const raw = await searchWithGitHub(input);
    return {
      sources: normalizeSearchResults(raw, input),
      provider: "github_public_search",
    };
  }
  const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
  endpoint.searchParams.set("q", input.query);
  endpoint.searchParams.set("count", String(input.maxResults));
  endpoint.searchParams.set("safesearch", "moderate");
  if (input.freshness === "recent")
    endpoint.searchParams.set("freshness", "pm");
  if (input.freshness === "current")
    endpoint.searchParams.set("freshness", "pw");
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`SEARCH_PROVIDER_${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 1_000_000) throw new Error("SEARCH_RESPONSE_TOO_LARGE");
  const body = (await response.json()) as {
    web?: {
      results?: Array<{
        title?: unknown;
        url?: unknown;
        description?: unknown;
        page_age?: unknown;
      }>;
    };
  };
  return {
    sources: normalizeSearchResults(body.web?.results ?? [], input),
    provider: "brave",
  };
}

export async function searchWeb(
  input: SearchWebInput,
): Promise<SearchResult[]> {
  return (await searchWebWithProvider(input)).sources;
}
