import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http.js";

export async function checkSafeBrowsing(url: string) {
  const key = requireEnv("GOOGLE_SAFE_BROWSING_API_KEY");
  const res = await safeFetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "cybersuite-ai", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    },
  );
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: { message?: string } })?.error?.message || `Safe Browsing HTTP ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }
  const matches = Array.isArray((data as { matches?: unknown[] }).matches)
    ? (data as { matches: unknown[] }).matches
    : [];
  return { safe: matches.length === 0, matches, raw: data };
}

