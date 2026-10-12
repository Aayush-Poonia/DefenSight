import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors.js";
import { settleProvider } from "./_lib/http.js";
import { fetchAbuseIpDb } from "./_lib/providers/abuseipdb.js";
import { searchThreatFox } from "./_lib/providers/abusech.js";
import { fetchAbstractIp } from "./_lib/providers/abstract.js";
import { fetchCensysHost } from "./_lib/providers/censys.js";
import { fetchHackerTargetIpBundle } from "./_lib/providers/hackertarget.js";
import { fetchIpApi } from "./_lib/providers/ipapi.js";
import { fetchIpinfoLite } from "./_lib/providers/ipinfo.js";
import { fetchMaxMindGeoIp } from "./_lib/providers/maxmind.js";
import { fetchOtxIp } from "./_lib/providers/otx.js";
import { fetchVirusTotalIp, vtStats } from "./_lib/providers/virustotal.js";
import { scoreIp } from "./_lib/threat-score.js";
import { validateIp } from "./_lib/validators.js";

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function nested(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const ip = validateIp(req.body?.ip ?? req.body?.ip_address);
    const [ipinfo, abstract, vt, abuse, otx, tfox, censys, maxmind, ipapi, hackertarget] = await Promise.all([
      settleProvider("ipinfo_lite", () => fetchIpinfoLite(ip)),
      settleProvider("abstract_ip", () => fetchAbstractIp(ip)),
      settleProvider("virustotal", () => fetchVirusTotalIp(ip)),
      settleProvider("abuseipdb", () => fetchAbuseIpDb(ip)),
      settleProvider("otx", () => fetchOtxIp(ip)),
      settleProvider("threatfox", () => searchThreatFox(ip)),
      settleProvider("censys", () => fetchCensysHost(ip)),
      settleProvider("maxmind", () => fetchMaxMindGeoIp(ip)),
      settleProvider("ip_api", () => fetchIpApi(ip)),
      settleProvider("hackertarget", () => fetchHackerTargetIpBundle(ip)),
    ]);

    const lite = (ipinfo.ok && ipinfo.data) ? ipinfo.data : {};
    const abs = (abstract.ok && abstract.data) ? abstract.data : {};
    const security = asObj(nested(abs, "security") ?? abs.security ?? {});
    const company = asObj(nested(abs, "company") ?? abs.company ?? {});
    const asnObj = asObj(nested(abs, "asn") ?? abs.asn ?? {});
    const location = asObj(nested(abs, "location") ?? abs);

    const abuseData = abuse.ok ? asObj(asObj(abuse.data).data) : {};
    const abuseConfidence = num(abuseData.abuseConfidenceScore);
    const abuseReports = num(abuseData.totalReports);

    const vtRaw = (vt.ok && vt.data) ? vt.data : {};
    const vtS = vt.ok ? vtStats(vtRaw) : { malicious: 0, suspicious: 0, total: 0, harmless: 0 };

    const otxRaw = (otx.ok && otx.data) ? otx.data : {};
    const otxPulseInfo = asObj(otxRaw.pulse_info);
    const otxPulses = num(otxPulseInfo.count) ?? 0;

    const tfoxRaw = (tfox.ok && tfox.data) ? tfox.data : {};
    const tfoxData = Array.isArray(tfoxRaw.data) ? tfoxRaw.data : [];
    const threatFoxHits = tfoxData.length;

    const censysRaw = (censys.ok && censys.data) ? censys.data : null;
    const censysServicesCount = censysRaw?.service_count ?? censysRaw?.open_ports?.length ?? 0;
    const censysHasRiskyPorts = Boolean(censysRaw?.has_risky_ports);
    const censysRiskyPorts = censysRaw?.risky_ports_found ?? [];

    const htRaw = (hackertarget.ok && hackertarget.data) ? hackertarget.data : null;
    const htGeo = htRaw?.geo;
    const reverseIpCount = htRaw?.reverse_ip?.count ?? 0;
    const ipapiRaw = (ipapi.ok && ipapi.data) ? ipapi.data : null;

    const maxmindRaw = (maxmind.ok && maxmind.data) ? maxmind.data : null;
    const maxmindSec = maxmindRaw?.security ?? {
      is_anonymous: false,
      is_anonymous_vpn: false,
      is_anonymous_proxy: false,
      is_tor: false,
      is_hosting: false,
      is_satellite: false,
    };

    const country =
      (lite.country as string) ||
      ipapiRaw?.country ||
      (location.country as string) ||
      (abs.country as string) ||
      maxmindRaw?.country ||
      htGeo?.country ||
      censysRaw?.location?.country ||
      null;
    const region =
      ipapiRaw?.region ||
      (location.region as string) ||
      (abs.region as string) ||
      maxmindRaw?.region ||
      htGeo?.state ||
      censysRaw?.location?.province ||
      null;
    const city = ipapiRaw?.city || htGeo?.city || maxmindRaw?.city || null;
    const timezone = ipapiRaw?.timezone || maxmindRaw?.timezone || null;
    const latitude = ipapiRaw?.latitude ?? htGeo?.latitude ?? maxmindRaw?.latitude ?? null;
    const longitude = ipapiRaw?.longitude ?? htGeo?.longitude ?? maxmindRaw?.longitude ?? null;
    const asn =
      (lite.asn as string) ||
      ipapiRaw?.asn ||
      (asnObj.asn as string) ||
      (abs.autonomous_system_number as string) ||
      htRaw?.asn?.asn ||
      (maxmindRaw?.asn ? `AS${maxmindRaw.asn}` : null) ||
      (censysRaw?.autonomous_system?.asn ? `AS${censysRaw.autonomous_system.asn}` : null) ||
      null;
    const org =
      (lite.as_name as string) ||
      ipapiRaw?.org ||
      ipapiRaw?.as_name ||
      (company.name as string) ||
      (asnObj.name as string) ||
      (abs.isp as string) ||
      htGeo?.isp ||
      htRaw?.asn?.org ||
      maxmindRaw?.asn_organization ||
      censysRaw?.autonomous_system?.name ||
      null;
    const isp = ipapiRaw?.isp || htGeo?.isp || org;
    const hosting =
      security.is_hosting === true ||
      security.hosting === true ||
      abs.is_hosting === true ||
      maxmindSec.is_hosting === true ||
      ipapiRaw?.is_hosting === true;
    const ipType = hosting
      ? "hosting"
      : security.is_mobile || abs.is_mobile || ipapiRaw?.is_mobile || cidTags?.is_mobile
        ? "mobile"
        : security.is_vpn || security.vpn || maxmindSec.is_anonymous_vpn
          ? "vpn"
          : ipapiRaw?.is_proxy
            ? "proxy/vpn"
            : "residential/unknown";

    const sec = {
      is_vpn: Boolean(security.is_vpn ?? security.vpn ?? abs.is_vpn ?? maxmindSec.is_anonymous_vpn),
      is_proxy: Boolean(
        security.is_proxy ?? security.proxy ?? abs.is_proxy ?? maxmindSec.is_anonymous_proxy ?? ipapiRaw?.is_proxy,
      ),
      is_tor: Boolean(security.is_tor ?? security.tor ?? abs.is_tor ?? maxmindSec.is_tor),
      is_hosting: Boolean(hosting),
      is_abuse: Boolean(
        security.is_abuse ?? security.abuse ?? abs.is_abuse ?? (abuseConfidence != null && abuseConfidence >= 25),
      ),
      is_relay: Boolean(security.is_relay ?? security.relay),
      is_mobile: Boolean(security.is_mobile ?? abs.is_mobile ?? ipapiRaw?.is_mobile),
      has_risky_open_ports: censysHasRiskyPorts,
    };

    const threat = scoreIp({
      ...sec,
      abuseConfidence,
      vtMalicious: vtS.malicious,
      vtTotal: vtS.total,
      otxPulses,
      threatFoxHits,
      censysServicesCount,
      censysHasRiskyPorts,
      censysRiskyPorts,
      reverseIpHostCount: reverseIpCount,
    });

    const result = {
      ip,
      country,
      region,
      city,
      timezone,
      latitude,
      longitude,
      asn,
      isp,
      organization: org,
      reverse_dns: htRaw?.reverse_dns?.hostname || censysRaw?.reverse_dns || null,
      reverse_ip_domains: htRaw?.reverse_ip?.domains?.slice(0, 12) || [],
      hosting_provider: hosting ? org : null,
      ip_type: ipType,
      security: sec,
      threat_score: threat.score,
      risk_level: threat.risk_level,
      threat,
      summary: {
        query: ip,
        location: [city, region, country].filter(Boolean).join(", ") || "Unknown",
        network: [asn, isp || org].filter(Boolean).join(" — ") || "Unknown",
        risk_flags: [
          sec.is_vpn ? "vpn" : null,
          sec.is_proxy ? "proxy" : null,
          sec.is_tor ? "tor" : null,
          hosting ? "hosting" : null,
          sec.is_abuse ? "abuse" : null,
          abuseConfidence && abuseConfidence >= 25 ? "abuseipdb" : null,
          vtS.malicious > 0 ? "virustotal" : null,
          otxPulses > 0 ? "otx" : null,
          threatFoxHits > 0 ? "threatfox" : null,
          censysHasRiskyPorts ? "censys_exposed_ports" : null,
          reverseIpCount > 8 ? "shared_hosting" : null,
          ipapiRaw?.is_proxy ? "ipapi_proxy" : null,
          ipapiRaw?.is_hosting ? "ipapi_hosting" : null,
        ].filter(Boolean),
        assessment: threat.reasons[0] || "No major anonymity/abuse flags from available sources",
      },
      intel: {
        abuseipdb: {
          confidence: abuseConfidence,
          reports: abuseReports,
          country: abuseData.countryCode ?? null,
          isp: abuseData.isp ?? null,
        },
        virustotal: {
          malicious: vtS.malicious,
          suspicious: vtS.suspicious,
          harmless: vtS.harmless,
          total: vtS.total,
        },
        otx: { pulses: otxPulses, reputation: num(otxRaw.reputation) },
        threatfox: { hits: threatFoxHits },
        censys: censysRaw
          ? {
              service_count: censysServicesCount,
              open_ports: censysRaw.open_ports,
              risky_ports: censysRiskyPorts,
              reverse_dns: censysRaw.reverse_dns,
              asn: censysRaw.autonomous_system?.asn,
              asn_name: censysRaw.autonomous_system?.name,
              services: censysRaw.services,
            }
          : null,
        maxmind: maxmindRaw
          ? {
              country: maxmindRaw.country,
              country_code: maxmindRaw.country_code,
              city: maxmindRaw.city,
              region: maxmindRaw.region,
              continent: maxmindRaw.continent,
              timezone: maxmindRaw.timezone,
              latitude: maxmindRaw.latitude,
              longitude: maxmindRaw.longitude,
              accuracy_radius: maxmindRaw.accuracy_radius,
              asn: maxmindRaw.asn,
              asn_organization: maxmindRaw.asn_organization,
              network: maxmindRaw.network,
              security: maxmindRaw.security,
            }
          : null,
        ipapi: ipapiRaw,
        hackertarget: htRaw,
      },
      sources: {
        ipinfo: ipinfo.ok ? { ok: true } : { error: ipinfo.error },
        abstract: abstract.ok ? { ok: true } : { error: abstract.error },
        virustotal: vt.ok ? { ok: true } : { error: vt.error },
        abuseipdb: abuse.ok ? { ok: true } : { error: abuse.error },
        otx: otx.ok ? { ok: true } : { error: otx.error },
        threatfox: tfox.ok ? { ok: true } : { error: tfox.error },
        censys: censys.ok ? { ok: true } : { error: censys.error },
        maxmind: maxmind.ok ? { ok: true } : { error: maxmind.error },
        ip_api: ipapi.ok ? { ok: true } : { error: ipapi.error },
        hackertarget: hackertarget.ok ? { ok: true } : { error: hackertarget.error },
      },
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/ip]", e);
    return sendError(res, e);
  }
}

