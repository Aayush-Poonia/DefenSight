import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http.js";

export type IpinfoLite = {
  ip?: string;
  asn?: string;
  as_name?: string;
  as_domain?: string;
  country_code?: string;
  country?: string;
  continent_code?: string;
  continent?: string;
};

export async function fetchIpinfoLite(ip: string): Promise<IpinfoLite> {
  const token = requireEnv("IPINFO_TOKEN");
  const res = await safeFetch(`https://api.ipinfo.io/lite/${encodeURIComponent(ip)}?token=${encodeURIComponent(token)}`);
  const data = (await parseJsonSafe(res)) as IpinfoLite & { error?: string };
  if (!res.ok) {
    throw new ApiError(data?.error || `IPinfo Lite HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  }
  return data;
}

