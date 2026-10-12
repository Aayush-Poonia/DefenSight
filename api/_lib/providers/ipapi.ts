import { ApiError, optionalEnv, parseJsonSafe, safeFetch } from "../http.js";

const FIELDS = [
  "status",
  "message",
  "continent",
  "continentCode",
  "country",
  "countryCode",
  "region",
  "regionName",
  "city",
  "zip",
  "lat",
  "lon",
  "timezone",
  "isp",
  "org",
  "as",
  "asname",
  "mobile",
  "proxy",
  "hosting",
  "query",
].join(",");

export type IpApiData = {
  country: string | null;
  country_code: string | null;
  region: string | null;
  region_code: string | null;
  city: string | null;
  zip: string | null;
  continent: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  org: string | null;
  asn: string | null;
  as_name: string | null;
  is_mobile: boolean;
  is_proxy: boolean;
  is_hosting: boolean;
};

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseAsn(asField: string | null): { asn: string | null; as_name: string | null } {
  if (!asField) return { asn: null, as_name: null };
  const m = asField.match(/^AS(\d+)\s*(.*)$/i);
  if (!m) return { asn: asField, as_name: null };
  return { asn: `AS${m[1]}`, as_name: m[2]?.trim() || null };
}

function normalize(data: Record<string, unknown>): IpApiData {
  const parsedAsn = parseAsn(str(data.as));
  return {
    country: str(data.country),
    country_code: str(data.countryCode),
    region: str(data.regionName),
    region_code: str(data.region),
    city: str(data.city),
    zip: str(data.zip),
    continent: str(data.continent),
    timezone: str(data.timezone),
    latitude: num(data.lat),
    longitude: num(data.lon),
    isp: str(data.isp),
    org: str(data.org),
    asn: parsedAsn.asn,
    as_name: str(data.asname) || parsedAsn.as_name,
    is_mobile: data.mobile === true,
    is_proxy: data.proxy === true,
    is_hosting: data.hosting === true,
  };
}

export async function fetchIpApi(ip: string): Promise<IpApiData> {
  const key = optionalEnv("IP_API_KEY");
  const qs = `fields=${encodeURIComponent(FIELDS)}`;
  const urls = key
    ? [`https://pro.ip-api.com/json/${encodeURIComponent(ip)}?key=${encodeURIComponent(key)}&${qs}`]
    : [
        `http://ip-api.com/json/${encodeURIComponent(ip)}?${qs}`,
        `https://ip-api.com/json/${encodeURIComponent(ip)}?${qs}`,
      ];

  let lastError = "IP-API lookup failed";
  for (const url of urls) {
    try {
      const res = await safeFetch(
        url,
        { headers: { Accept: "application/json", "User-Agent": "CyberSuite-IPIntel/1.0" } },
        10000,
      );
      const data = (await parseJsonSafe(res)) as Record<string, unknown>;
      if (!res.ok) {
        lastError = str(data?.message) || `IP-API HTTP ${res.status}`;
        continue;
      }
      if (data?.status === "fail") {
        lastError = str(data.message) || "IP-API query failed";
        continue;
      }
      if (!data?.country && !data?.isp && !data?.query) {
        lastError = "IP-API returned an empty payload";
        continue;
      }
      return normalize(data);
    } catch (e) {
      lastError = e instanceof Error ? e.message : lastError;
    }
  }
  throw new ApiError(lastError, 502);
}
