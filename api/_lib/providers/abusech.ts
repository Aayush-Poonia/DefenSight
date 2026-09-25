import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http";

function abuseChHeaders() {
  return { "Auth-Key": requireEnv("ABUSE_CH_API_KEY"), "Content-Type": "application/json" };
}

export async function searchThreatFox(term: string) {
  const res = await safeFetch("https://threatfox-api.abuse.ch/api/v1/", {
    method: "POST",
    headers: abuseChHeaders(),
    body: JSON.stringify({ query: "search_ioc", search_term: term }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new ApiError(`ThreatFox HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  return data as Record<string, unknown>;
}

export async function lookupMalwareBazaarHash(sha256: string) {
  const res = await safeFetch("https://mb-api.abuse.ch/api/v1/", {
    method: "POST",
    headers: abuseChHeaders(),
    body: JSON.stringify({ query: "get_info", "hash": sha256 }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new ApiError(`MalwareBazaar HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  return data as Record<string, unknown>;
}

export async function lookupUrlhaus(url: string) {
  const res = await safeFetch("https://urlhaus-api.abuse.ch/v1/url/", {
    method: "POST",
    headers: abuseChHeaders(),
    body: JSON.stringify({ url }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new ApiError(`URLhaus HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  return data as Record<string, unknown>;
}
