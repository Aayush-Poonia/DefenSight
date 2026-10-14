import { ApiError, parseJsonSafe, optionalEnv, safeFetch } from "../http.js";

/**
 * NVD (National Vulnerability Database) NIST 2.0 API.
 * Free public API; an API key raises the rate limit.
 */
const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";

function nvdHeaders(): Record<string, string> {
  const key = optionalEnv("NVD_API_KEY");
  return key ? { apiKey: key } : {};
}

export type NvdCve = {
  id: string;
  published?: string;
  lastModified?: string;
  vulnStatus?: string;
  descriptions?: Array<{ lang: string; value: string }>;
  metrics?: {
    cvssMetricV31?: Array<{
      cvssData: {
        version: string;
        vectorString?: string;
        baseScore?: number;
        baseSeverity?: string;
        confidentialityImpact?: string;
        integrityImpact?: string;
        availabilityImpact?: string;
        attackVector?: string;
        attackComplexity?: string;
        privilegesRequired?: string;
        userInteraction?: string;
        scope?: string;
      };
      exploitabilityScore?: number;
      impactScore?: number;
    }>;
    cvssMetricV30?: Array<{
      cvssData: { version: string; vectorString?: string; baseScore?: number; baseSeverity?: string };
    }>;
    cvssMetricV2?: Array<{
      cvssData: { version: string; vectorString?: string; baseScore?: number; baseSeverity?: string };
    }>;
  };
  weaknesses?: Array<{
    source: string;
    type: string;
    description: Array<{ lang: string; value: string }>;
  }>;
  configurations?: Array<{
    nodes: Array<{
      operator: string;
      cpeMatch: Array<{
        vulnerable: boolean;
        criteria: string;
        versionStartIncluding?: string;
        versionStartExcluding?: string;
        versionEndIncluding?: string;
        versionEndExcluding?: string;
        matchCriteriaId?: string;
      }>;
    }>;
  }>;
  references?: Array<{ url: string; source?: string; tags?: string[] }>;
};

export type NvdSearchResponse = {
  resultsPerPage: number;
  totalResults: number;
  vulnerabilities: Array<{ cve: NvdCve }>;
};

export async function searchNvdCves(params: {
  cveId?: string;
  keyword?: string;
  pubStartDate?: string;
  pubEndDate?: string;
  resultsPerPage?: number;
  startIndex?: number;
}): Promise<NvdSearchResponse> {
  const url = new URL(NVD_BASE);
  if (params.cveId) url.searchParams.set("cveId", params.cveId);
  if (params.keyword) url.searchParams.set("keywordSearch", params.keyword);
  if (params.pubStartDate) url.searchParams.set("pubStartDate", params.pubStartDate);
  if (params.pubEndDate) url.searchParams.set("pubEndDate", params.pubEndDate);
  url.searchParams.set("resultsPerPage", String(params.resultsPerPage ?? 20));
  if (params.startIndex != null) url.searchParams.set("startIndex", String(params.startIndex));

  const res = await safeFetch(url.toString(), { headers: nvdHeaders() }, 20000);
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      `NVD HTTP ${res.status}`,
      res.status === 403 || res.status === 429 ? 429 : 502,
    );
  }
  return (data as NvdSearchResponse) ?? { resultsPerPage: 0, totalResults: 0, vulnerabilities: [] };
}

export async function getNvdCve(cveId: string): Promise<NvdCve | null> {
  const resp = await searchNvdCves({ cveId, resultsPerPage: 1 });
  return resp.vulnerabilities[0]?.cve ?? null;
}
