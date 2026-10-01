import { ApiError, parseJsonSafe, optionalEnv, safeFetch } from "../http.js";

export type CensysHostData = {
  ip: string;
  location?: {
    country?: string | null;
    country_code?: string | null;
    city?: string | null;
    province?: string | null;
    timezone?: string | null;
  };
  autonomous_system?: {
    asn?: number | null;
    name?: string | null;
    description?: string | null;
    bgp_prefix?: string | null;
  };
  services?: Array<{
    port: number;
    service_name?: string;
    transport_protocol?: string;
    software?: Array<{ vendor?: string; product?: string }>;
  }>;
  service_count?: number;
  open_ports: number[];
  reverse_dns: string[];
  has_risky_ports: boolean;
  risky_ports_found: number[];
  raw?: Record<string, unknown>;
};

const RISKY_PORTS = [21, 23, 135, 139, 445, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 27017];

export async function fetchCensysHost(ip: string): Promise<CensysHostData> {
  const apiKey =
    optionalEnv("CENSYS_API_KEY") ||
    optionalEnv("CENSYS_PAT") ||
    optionalEnv("CENSYS_TOKEN");
  const apiId = optionalEnv("CENSYS_API_ID");
  const apiSecret = optionalEnv("CENSYS_API_SECRET");

  let url: string;
  let headers: Record<string, string> = { Accept: "application/json" };

  if (apiKey) {
    url = `https://api.platform.censys.io/v3/global/asset/host/${encodeURIComponent(ip)}`;
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (apiId && apiSecret) {
    url = `https://search.censys.io/api/v2/hosts/${encodeURIComponent(ip)}`;
    const auth = Buffer.from(`${apiId}:${apiSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${auth}`;
  } else {
    throw new ApiError("Server missing CENSYS_API_KEY or CENSYS_API_ID / CENSYS_API_SECRET", 500);
  }

  const res = await safeFetch(url, { headers });
  const data = (await parseJsonSafe(res)) as Record<string, unknown>;

  if (!res.ok) {
    const detail =
      (data as { detail?: string })?.detail ||
      (data as { error?: string })?.error ||
      `Censys HTTP ${res.status}`;
    throw new ApiError(detail, res.status === 429 ? 429 : 502);
  }

  // Parse response (Platform API v3 nested under result.resource, or Search API v2 under result)
  const resultObj = (data?.result && typeof data.result === "object" ? data.result : {}) as Record<string, unknown>;
  const resource = (resultObj.resource && typeof resultObj.resource === "object"
    ? resultObj.resource
    : resultObj) as Record<string, unknown>;

  const servicesArr = Array.isArray(resource.services)
    ? (resource.services as Array<Record<string, unknown>>)
    : [];

  const open_ports = servicesArr
    .map((s) => (typeof s.port === "number" ? s.port : null))
    .filter((p): p is number => p !== null);

  const risky_ports_found = open_ports.filter((p) => RISKY_PORTS.includes(p));

  const dnsObj = (resource.dns && typeof resource.dns === "object" ? resource.dns : {}) as Record<string, unknown>;
  const rdnsObj = (dnsObj.reverse_dns && typeof dnsObj.reverse_dns === "object" ? dnsObj.reverse_dns : {}) as Record<string, unknown>;
  const reverse_dns = Array.isArray(rdnsObj.names)
    ? (rdnsObj.names as string[]).filter((n) => typeof n === "string")
    : [];

  const loc = (resource.location && typeof resource.location === "object" ? resource.location : {}) as Record<string, unknown>;
  const as = (resource.autonomous_system && typeof resource.autonomous_system === "object" ? resource.autonomous_system : {}) as Record<string, unknown>;

  return {
    ip,
    location: {
      country: (loc.country as string) || null,
      country_code: (loc.country_code as string) || null,
      city: (loc.city as string) || null,
      province: (loc.province as string) || null,
      timezone: (loc.timezone as string) || null,
    },
    autonomous_system: {
      asn: typeof as.asn === "number" ? as.asn : null,
      name: (as.name as string) || (as.description as string) || null,
      description: (as.description as string) || null,
      bgp_prefix: (as.bgp_prefix as string) || null,
    },
    services: servicesArr.map((s) => ({
      port: Number(s.port || 0),
      service_name: (s.service_name as string) || (s.extended_service_name as string) || undefined,
      transport_protocol: (s.transport_protocol as string) || undefined,
    })),
    service_count: typeof resource.service_count === "number" ? resource.service_count : open_ports.length,
    open_ports,
    reverse_dns,
    has_risky_ports: risky_ports_found.length > 0,
    risky_ports_found,
    raw: data,
  };
}
