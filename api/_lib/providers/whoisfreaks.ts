import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http.js";

export async function fetchWhoisFreaks(domain: string): Promise<Record<string, unknown>> {
  const key = requireEnv("WHOISFREAKS_API_KEY");
  const url =
    `https://api.whoisfreaks.com/v1.0/whois?whois=live` +
    `&domainName=${encodeURIComponent(domain)}` +
    `&apiKey=${encodeURIComponent(key)}`;
  const res = await safeFetch(url, {}, 15000);
  const data = (await parseJsonSafe(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (data?.error as string) || (data?.message as string) || `WhoisFreaks HTTP ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }
  return data;
}

