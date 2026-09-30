import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http.js";

const HEADERS = (key: string) => ({
  "API-Key": key,
  "api-key": key,
});

function escapeLucene(value: string): string {
  return value.replace(/([+\-!(){}[\]^"~*?:\\/])/g, "\\$1");
}

function buildSearchQuery(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return `domain:${escapeLucene(host)}`;
  } catch {
    return `page.url:"${escapeLucene(url)}"`;
  }
}

function hitSource(hit: Record<string, unknown>): Record<string, unknown> {
  const src = hit._source;
  return src && typeof src === "object" ? (src as Record<string, unknown>) : hit;
}

export function extractUrlscanUuid(hit: Record<string, unknown>): string | null {
  const src = hitSource(hit);
  const task = src.task as { uuid?: string } | undefined;
  if (typeof task?.uuid === "string" && task.uuid) return task.uuid;

  if (typeof hit._id === "string" && /^[0-9a-f-]{36}$/i.test(hit._id)) return hit._id;

  const resultLink = src.result;
  if (typeof resultLink === "string") {
    const m = resultLink.match(/\/result\/([0-9a-f-]{36})/i);
    if (m) return m[1];
  }

  const api = src.api as string | undefined;
  if (api) {
    const m = api.match(/\/result\/([0-9a-f-]{36})/i);
    if (m) return m[1];
  }

  return null;
}

/** Map a search hit or full result into the shape PhishGuard expects. */
export function normalizeUrlscanResult(raw: Record<string, unknown>): Record<string, unknown> {
  const src = hitSource(raw);
  return {
    page: src.page ?? raw.page,
    verdicts: src.verdicts ?? raw.verdicts,
    stats: src.stats ?? raw.stats,
    lists: src.lists ?? raw.lists,
    requests: src.requests ?? raw.requests,
    task: src.task ?? raw.task,
    meta: src.meta ?? raw.meta,
  };
}

export async function searchUrlscan(url: string): Promise<Record<string, unknown>> {
  const key = requireEnv("URLSCAN_API_KEY");
  const q = buildSearchQuery(url);
  const res = await safeFetch(
    `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(q)}&size=5`,
    { headers: HEADERS(key) },
    15000,
  );
  const data = (await parseJsonSafe(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (data?.message as string) || (data?.description as string) || `urlscan search HTTP ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }
  return data;
}

async function fetchUrlscanResult(uuid: string, key: string): Promise<Record<string, unknown> | null> {
  const res = await safeFetch(`https://urlscan.io/api/v1/result/${uuid}/`, {
    headers: HEADERS(key),
  }, 12000);
  if (!res.ok) return null;
  return (await parseJsonSafe(res)) as Record<string, unknown>;
}

export async function submitAndFetchUrlscan(url: string): Promise<{
  uuid: string | null;
  screenshot: string | null;
  result: Record<string, unknown> | null;
  search: Record<string, unknown> | null;
  status: "found" | "submitted" | "pending" | "empty";
  message?: string;
}> {
  const key = requireEnv("URLSCAN_API_KEY");
  let search: Record<string, unknown> | null = null;
  let searchError: string | null = null;

  try {
    search = await searchUrlscan(url);
    const results = Array.isArray(search.results) ? (search.results as Record<string, unknown>[]) : [];
    if (results.length > 0) {
      const top = results[0];
      const uuid = extractUrlscanUuid(top);
      let result: Record<string, unknown> | null = normalizeUrlscanResult(top);

      // Enrich with full result when available (redirect chain, requests, etc.)
      if (uuid) {
        const full = await fetchUrlscanResult(uuid, key);
        if (full) result = normalizeUrlscanResult(full);
      }

      return {
        uuid,
        screenshot: uuid ? `https://urlscan.io/screenshots/${uuid}.png` : null,
        result,
        search,
        status: "found",
      };
    }
  } catch (e) {
    searchError = e instanceof Error ? e.message : "urlscan search failed";
  }

  // No historical scan â€” submit a new one
  const submit = await safeFetch(
    "https://urlscan.io/api/v1/scan/",
    {
      method: "POST",
      headers: { ...HEADERS(key), "Content-Type": "application/json" },
      body: JSON.stringify({ url, visibility: "unlisted" }),
    },
    20000,
  );
  const submitted = (await parseJsonSafe(submit)) as { uuid?: string; message?: string; description?: string };

  if (!submit.ok || !submitted.uuid) {
    const msg =
      submitted.message ||
      submitted.description ||
      searchError ||
      `urlscan submit HTTP ${submit.status}`;
    throw new ApiError(msg, submit.status === 429 ? 429 : 502);
  }

  const uuid = submitted.uuid;

  // Poll briefly (serverless-safe: ~12s max)
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const full = await fetchUrlscanResult(uuid, key);
    if (full) {
      return {
        uuid,
        screenshot: `https://urlscan.io/screenshots/${uuid}.png`,
        result: normalizeUrlscanResult(full),
        search,
        status: "submitted",
      };
    }
  }

  // Scan queued â€” return uuid + screenshot URL even if result not ready yet
  return {
    uuid,
    screenshot: `https://urlscan.io/screenshots/${uuid}.png`,
    result: null,
    search,
    status: "pending",
    message: "Scan submitted â€” full result still processing on urlscan.io",
  };
}

