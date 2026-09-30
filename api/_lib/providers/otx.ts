import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http.js";

function otxHeaders() {
  return { "X-OTX-API-KEY": requireEnv("ALIENVAULT_OTX_API_KEY") };
}

export async function fetchOtxIp(ip: string) {
  const res = await safeFetch(`https://otx.alienvault.com/api/v1/indicators/IPv4/${encodeURIComponent(ip)}/general`, {
    headers: otxHeaders(),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new ApiError(`OTX IP HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  return data as Record<string, unknown>;
}

export async function fetchOtxDomain(domain: string) {
  const res = await safeFetch(
    `https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(domain)}/general`,
    { headers: otxHeaders() },
  );
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new ApiError(`OTX domain HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  return data as Record<string, unknown>;
}

export async function fetchOtxUrl(url: string) {
  const encoded = encodeURIComponent(url);
  const res = await safeFetch(`https://otx.alienvault.com/api/v1/indicators/url/${encoded}/general`, {
    headers: otxHeaders(),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new ApiError(`OTX URL HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  return data as Record<string, unknown>;
}

