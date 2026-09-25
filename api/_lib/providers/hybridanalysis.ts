import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http";

export async function searchHybridAnalysisHash(sha256: string) {
  const key = requireEnv("HYBRID_ANALYSIS_API_KEY");
  const res = await safeFetch(
    `https://www.hybrid-analysis.com/api/v2/search/hash?hash=${encodeURIComponent(sha256)}`,
    {
      headers: {
        "api-key": key,
        "User-Agent": "CyberSuite AI",
        Accept: "application/json",
      },
    },
    20000,
  );
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      (data as { message?: string })?.message || `Hybrid Analysis HTTP ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }
  return data;
}
