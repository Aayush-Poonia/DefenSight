import { ApiError, parseJsonSafe, safeFetch } from "../http.js";

/**
 * OSV.dev — open source vulnerability database.
 * No API key required. Free public API.
 */
const OSV_BASE = "https://api.osv.dev/v1";

export type OsvPackage = {
  name: string;
  ecosystem: string;
  purl?: string;
};

export type OsvAffectedRange = {
  type?: string;
  repo?: string;
  events?: Array<{ introduced?: string; fixed?: string; limit?: string; last_affected?: string }>;
  database_specific?: Record<string, unknown>;
};

export type OsvAffected = {
  package?: OsvPackage;
  ranges?: OsvAffectedRange[];
  versions?: string[];
  database_specific?: Record<string, unknown>;
  ecosystem_specific?: Record<string, unknown>;
};

export type OsvSeverity = {
  type: string;
  score: string;
};

export type OsvVuln = {
  id: string;
  published?: string;
  modified?: string;
  withdrawn?: string;
  aliases?: string[];
  related?: string[];
  summary?: string;
  details?: string;
  severity?: OsvSeverity[];
  affected?: OsvAffected[];
  references?: Array<{ type: string; url: string }>;
  database_specific?: Record<string, unknown>;
  schema_version?: string;
};

export type OsvQueryResponse = {
  vulns?: OsvVuln[];
};

export async function queryOsvByPackage(
  pkg: OsvPackage,
  version?: string,
): Promise<OsvQueryResponse> {
  const body: Record<string, unknown> = { package: { name: pkg.name, ecosystem: pkg.ecosystem } };
  if (pkg.purl) body.purl = pkg.purl;
  if (version) body.version = version;

  const res = await safeFetch(
    `${OSV_BASE}/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    20000,
  );
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(`OSV query HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  }
  return (data as OsvQueryResponse) ?? { vulns: [] };
}

export async function queryOsvByVulnId(id: string): Promise<OsvQueryResponse> {
  const res = await safeFetch(
    `${OSV_BASE}/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vuln_id: id }),
    },
    20000,
  );
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(`OSV vuln query HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  }
  return (data as OsvQueryResponse) ?? { vulns: [] };
}

export async function getOsvVuln(id: string): Promise<OsvVuln | null> {
  const res = await safeFetch(`${OSV_BASE}/vulns/${encodeURIComponent(id)}`, {}, 15000);
  if (res.status === 404) return null;
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(`OSV vuln HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  }
  return (data as OsvVuln) ?? null;
}
