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
export async function searchWeb(
  input: SearchWebInput,
): Promise<SearchResult[]> {
  if (!process.env.BRAVE_SEARCH_API_KEY)
    throw new Error("SEARCH_PROVIDER_NOT_CONFIGURED");
  if (
    input.query.trim().length < 1 ||
    input.query.length > 500 ||
    input.maxResults < 1 ||
    input.maxResults > 10
  )
    throw new Error("INVALID_SEARCH_INPUT");
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
  return normalizeSearchResults(body.web?.results ?? [], input);
}
