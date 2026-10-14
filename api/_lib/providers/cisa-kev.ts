import { ApiError, parseJsonSafe, safeFetch } from "../http.js";

/**
 * CISA Known Exploited Vulnerabilities (KEV) Catalog.
 * Free public JSON feed; no API key required.
 */
const CISA_KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

export type CisaKevEntry = {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
  notes?: string;
};

export type CisaKevCatalog = {
  catalogVersion: string;
  dateReleased: string;
  count: number;
  vulnerabilities: CisaKevEntry[];
};

let cache: { data: CisaKevCatalog; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

export async function getCisaKevCatalog(forceRefresh = false): Promise<CisaKevCatalog> {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const res = await safeFetch(CISA_KEV_URL, {}, 30000);
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(`CISA KEV HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  }
  const catalog = (data as CisaKevCatalog) ?? {
    catalogVersion: "",
    dateReleased: "",
    count: 0,
    vulnerabilities: [],
  };
  cache = { data: catalog, fetchedAt: now };
  return catalog;
}

export async function checkCisaKev(cveIds: string[]): Promise<Record<string, CisaKevEntry>> {
  const catalog = await getCisaKevCatalog();
  const ids = new Set(cveIds.map((c) => c.toUpperCase()));
  const result: Record<string, CisaKevEntry> = {};
  for (const v of catalog.vulnerabilities) {
    if (ids.has(v.cveID.toUpperCase())) {
      result[v.cveID.toUpperCase()] = v;
    }
  }
  return result;
}
