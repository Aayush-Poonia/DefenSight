import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http";

export async function fetchAbuseIpDb(ip: string) {
  const key = requireEnv("ABUSEIPDB_API_KEY");
  const res = await safeFetch(
    `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`,
    { headers: { Key: key, Accept: "application/json" } },
  );
  const data = (await parseJsonSafe(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (data?.errors as { detail?: string }[])?.[0]?.detail || `AbuseIPDB HTTP ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }
  return data;
}
