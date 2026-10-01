import { ApiError, parseJsonSafe, optionalEnv, safeFetch } from "../http.js";

export type MaxMindGeoData = {
  ip: string;
  country: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  region_code: string | null;
  continent: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_radius: number | null;
  asn: number | null;
  asn_organization: string | null;
  network: string | null;
  security: {
    is_anonymous: boolean;
    is_anonymous_vpn: boolean;
    is_anonymous_proxy: boolean;
    is_tor: boolean;
    is_hosting: boolean;
    is_satellite: boolean;
  };
  raw?: Record<string, unknown>;
};

export async function fetchMaxMindGeoIp(ip: string): Promise<MaxMindGeoData> {
  const accountId = optionalEnv("MAXMIND_ACCOUNT_ID");
  const licenseKey = optionalEnv("MAXMIND_LICENSE_KEY");

  if (!accountId || !licenseKey) {
    throw new ApiError("Server missing MAXMIND_ACCOUNT_ID or MAXMIND_LICENSE_KEY", 500);
  }

  const authHeader = `Basic ${Buffer.from(`${accountId}:${licenseKey}`).toString("base64")}`;
  const headers = {
    Authorization: authHeader,
    Accept: "application/json",
  };

  // Try GeoLite2 endpoint (geolite.info) first, fallback to GeoIP2 (geoip.maxmind.com)
  let res = await safeFetch(`https://geolite.info/geoip/v2.1/city/${encodeURIComponent(ip)}`, { headers });

  if (res.status === 403) {
    // Retry with paid endpoint if user's license key has paid endpoint permissions
    const fallbackRes = await safeFetch(`https://geoip.maxmind.com/geoip/v2.1/city/${encodeURIComponent(ip)}`, { headers });
    if (fallbackRes.ok) {
      res = fallbackRes;
    }
  }

  const data = (await parseJsonSafe(res)) as Record<string, unknown>;

  if (!res.ok) {
    const detail =
      (data as { error?: string })?.error ||
      (data as { code?: string })?.code ||
      `MaxMind HTTP ${res.status}`;
    throw new ApiError(detail, res.status === 429 ? 429 : 502);
  }

  const countryObj = (data.country && typeof data.country === "object" ? data.country : {}) as Record<string, unknown>;
  const countryNames = (countryObj.names && typeof countryObj.names === "object" ? countryObj.names : {}) as Record<string, unknown>;
  const country = (countryNames.en as string) || null;
  const country_code = (countryObj.iso_code as string) || null;

  const cityObj = (data.city && typeof data.city === "object" ? data.city : {}) as Record<string, unknown>;
  const cityNames = (cityObj.names && typeof cityObj.names === "object" ? cityObj.names : {}) as Record<string, unknown>;
  const city = (cityNames.en as string) || null;

  const subs = Array.isArray(data.subdivisions) ? (data.subdivisions as Array<Record<string, unknown>>) : [];
  const sub0 = subs[0] || {};
  const subNames = (sub0.names && typeof sub0.names === "object" ? sub0.names : {}) as Record<string, unknown>;
  const region = (subNames.en as string) || null;
  const region_code = (sub0.iso_code as string) || null;

  const contObj = (data.continent && typeof data.continent === "object" ? data.continent : {}) as Record<string, unknown>;
  const contNames = (contObj.names && typeof contObj.names === "object" ? contObj.names : {}) as Record<string, unknown>;
  const continent = (contNames.en as string) || null;

  const loc = (data.location && typeof data.location === "object" ? data.location : {}) as Record<string, unknown>;
  const latitude = typeof loc.latitude === "number" ? loc.latitude : null;
  const longitude = typeof loc.longitude === "number" ? loc.longitude : null;
  const timezone = (loc.time_zone as string) || null;
  const accuracy_radius = typeof loc.accuracy_radius === "number" ? loc.accuracy_radius : null;

  const traits = (data.traits && typeof data.traits === "object" ? data.traits : {}) as Record<string, unknown>;
  const asn = typeof traits.autonomous_system_number === "number" ? traits.autonomous_system_number : null;
  const asn_organization = (traits.autonomous_system_organization as string) || null;
  const network = (traits.network as string) || null;

  return {
    ip,
    country,
    country_code,
    city,
    region,
    region_code,
    continent,
    timezone,
    latitude,
    longitude,
    accuracy_radius,
    asn,
    asn_organization,
    network,
    security: {
      is_anonymous: Boolean(traits.is_anonymous),
      is_anonymous_vpn: Boolean(traits.is_anonymous_vpn),
      is_anonymous_proxy: Boolean(traits.is_anonymous_proxy),
      is_tor: Boolean(traits.is_tor_exit_node),
      is_hosting: Boolean(traits.is_hosting_provider),
      is_satellite: Boolean(traits.is_satellite_provider),
    },
    raw: data,
  };
}
