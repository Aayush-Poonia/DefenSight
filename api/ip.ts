import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors.js";
import { settleProvider } from "./_lib/http.js";
import { fetchAbuseIpDb } from "./_lib/providers/abuseipdb.js";
import { searchThreatFox } from "./_lib/providers/abusech.js";
import { fetchAbstractIp } from "./_lib/providers/abstract.js";
import { fetchIpinfoLite } from "./_lib/providers/ipinfo.js";
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
    const [ipinfo, abstract, vt, abuse, otx, tfox] = await Promise.all([
      settleProvider("ipinfo_lite", () => fetchIpinfoLite(ip)),
      settleProvider("abstract_ip", () => fetchAbstractIp(ip)),
      settleProvider("virustotal", () => fetchVirusTotalIp(ip)),
      settleProvider("abuseipdb", () => fetchAbuseIpDb(ip)),
      settleProvider("otx", () => fetchOtxIp(ip)),
      settleProvider("threatfox", () => searchThreatFox(ip)),
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

    const country =
      (lite.country as string) ||
      (location.country as string) ||
      (location.country_code as string) ||
      (abs.country as string) ||
      null;
    const region =
      (location.region as string) ||
      (location.region_iso_code as string) ||
      (abs.region as string) ||
      null;
    const asn =
      (lite.asn as string) ||
      (asnObj.asn as string) ||
      (abs.autonomous_system_number as string) ||
      null;
    const org =
      (lite.as_name as string) ||
      (company.name as string) ||
      (asnObj.name as string) ||
      (abs.isp as string) ||
      null;
    const hosting =
      security.is_hosting === true ||
      security.hosting === true ||
      abs.is_hosting === true;
    const ipType = hosting
      ? "hosting"
      : security.is_mobile || abs.is_mobile
        ? "mobile"
        : security.is_vpn || security.vpn
          ? "vpn"
          : "residential/unknown";

    const sec = {
      is_vpn: Boolean(security.is_vpn ?? security.vpn ?? abs.is_vpn),
      is_proxy: Boolean(security.is_proxy ?? security.proxy ?? abs.is_proxy),
      is_tor: Boolean(security.is_tor ?? security.tor ?? abs.is_tor),
      is_hosting: Boolean(hosting),
      is_abuse: Boolean(
        security.is_abuse ?? security.abuse ?? abs.is_abuse ?? (abuseConfidence != null && abuseConfidence >= 25),
      ),
      is_relay: Boolean(security.is_relay ?? security.relay),
      is_mobile: Boolean(security.is_mobile ?? abs.is_mobile),
    };

    const threat = scoreIp({
      ...sec,
      abuseConfidence,
      vtMalicious: vtS.malicious,
      vtTotal: vtS.total,
      otxPulses,
      threatFoxHits,
    });

    const result = {
      ip,
      country,
      region,
      asn,
      isp: org,
      organization: org,
      hosting_provider: hosting ? org : null,
      ip_type: ipType,
      security: sec,
      threat_score: threat.score,
      risk_level: threat.risk_level,
      threat,
      summary: {
        query: ip,
        location: [region, country].filter(Boolean).join(", ") || "Unknown",
        network: [asn, org].filter(Boolean).join(" â€” ") || "Unknown",
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
      },
      sources: {
        ipinfo: ipinfo.ok ? { ok: true } : { error: ipinfo.error },
        abstract: abstract.ok ? { ok: true } : { error: abstract.error },
        virustotal: vt.ok ? { ok: true } : { error: vt.error },
        abuseipdb: abuse.ok ? { ok: true } : { error: abuse.error },
        otx: otx.ok ? { ok: true } : { error: otx.error },
        threatfox: tfox.ok ? { ok: true } : { error: tfox.error },
      },
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/ip]", e);
    return sendError(res, e);
  }
}

