import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http.js";

function vtHeaders() {
  return { "x-apikey": requireEnv("VIRUSTOTAL_API_KEY") };
}

export async function fetchVirusTotalIp(ip: string) {
  const res = await safeFetch(`https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(ip)}`, {
    headers: vtHeaders(),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new ApiError(`VirusTotal IP HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  return data as Record<string, unknown>;
}

export async function fetchVirusTotalUrl(url: string) {
  const id = Buffer.from(url).toString("base64").replace(/=/g, "");
  const res = await safeFetch(`https://www.virustotal.com/api/v3/urls/${id}`, { headers: vtHeaders() });
  const data = await parseJsonSafe(res);
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new ApiError(`VirusTotal URL HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  return data as Record<string, unknown>;
}

export async function fetchVirusTotalFile(hash: string) {
  const res = await safeFetch(`https://www.virustotal.com/api/v3/files/${hash}`, { headers: vtHeaders() });
  const data = await parseJsonSafe(res);
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new ApiError(`VirusTotal file HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  return data as Record<string, unknown>;
}

export function vtStats(data: Record<string, unknown>) {
  const attrs = (data.data as { attributes?: { last_analysis_stats?: Record<string, number> } })?.attributes;
  const stats = attrs?.last_analysis_stats || {};
  const malicious = Number(stats.malicious || 0);
  const suspicious = Number(stats.suspicious || 0);
  const total = Object.values(stats).reduce((a, b) => a + Number(b || 0), 0);
  return { malicious, suspicious, total, harmless: Number(stats.harmless || 0) };
}

