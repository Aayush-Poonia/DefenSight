import { ApiError, parseJsonSafe, safeFetch } from "../http.js";

/**
 * FIRST EPSS (Exploit Prediction Scoring System).
 * Free public API; no API key required.
 */
const EPSS_BASE = "https://api.first.org/data/v1/epss";

export type EpssEntry = {
  cve: string;
  epss: string;
  percentile: string;
  date: string;
};

export type EpssResponse = {
  status?: string;
  "status-code"?: number;
  version?: string;
  total?: number;
  data?: EpssEntry[];
};

export async function getEpssScores(cveIds: string[]): Promise<Record<string, EpssEntry>> {
  const result: Record<string, EpssEntry> = {};
  if (!cveIds.length) return result;

  // EPSS supports comma-separated CVE IDs (max ~100 per request)
  const batches: string[][] = [];
  for (let i = 0; i < cveIds.length; i += 80) {
    batches.push(cveIds.slice(i, i + 80));
  }

  for (const batch of batches) {
    const cveParam = batch.map((c) => encodeURIComponent(c)).join(",");
    const res = await safeFetch(`${EPSS_BASE}?cve=${cveParam}`, {}, 15000);
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new ApiError(`EPSS HTTP ${res.status}`, res.status === 429 ? 429 : 502);
    }
    const resp = (data as EpssResponse) ?? { data: [] };
    for (const entry of resp.data ?? []) {
      result[entry.cve.toUpperCase()] = entry;
    }
  }

  return result;
}
