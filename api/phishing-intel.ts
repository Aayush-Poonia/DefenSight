import dns from "node:dns/promises";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors.js";
import { settleProvider } from "./_lib/http.js";
import { lookupUrlhaus, searchThreatFox } from "./_lib/providers/abusech.js";
import { fetchCensysHost } from "./_lib/providers/censys.js";
import { fetchHackerTargetPhishBundle } from "./_lib/providers/hackertarget.js";
import { fetchMaxMindGeoIp } from "./_lib/providers/maxmind.js";
import { fetchDnsDumpster, nsLooksSuspicious } from "./_lib/providers/dnsdumpster.js";
import { fetchOtxDomain, fetchOtxUrl } from "./_lib/providers/otx.js";
import { fetchPhishStats } from "./_lib/providers/phishstats.js";
import { checkSafeBrowsing } from "./_lib/providers/safebrowsing.js";
import { submitAndFetchUrlscan } from "./_lib/providers/urlscan.js";
import { fetchVirusTotalUrl, vtStats } from "./_lib/providers/virustotal.js";
import { fetchWhoisFreaks } from "./_lib/providers/whoisfreaks.js";
import { scorePhish } from "./_lib/threat-score.js";
import { validateUrl } from "./_lib/validators.js";

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function calcAgeDays(created: string | null): number | null {
  if (!created) return null;
  const ms = Date.now() - new Date(created).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86400000));
}

function extractDomain(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  const parts = host.split(".");
  if (parts.length > 2) return parts.slice(-2).join(".");
  return host;
}

async function resolveDomainIp(domain: string): Promise<string | null> {
  try {
    const ips = await dns.resolve4(domain);
    return ips && ips[0] ? ips[0] : null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const url = validateUrl(req.body?.url);
    const domain = extractDomain(url);

    const [phish, whois, urlscan, safeBrowsing, vt, urlhaus, otxUrl, otxDomain, tfox, dnsdumpster, hackertarget, resolvedIpByDns] =
      await Promise.all([
        settleProvider("phishstats", () => fetchPhishStats(url)),
        settleProvider("whoisfreaks", () => fetchWhoisFreaks(domain)),
        settleProvider("urlscan", () => submitAndFetchUrlscan(url)),
        settleProvider("safe_browsing", () => checkSafeBrowsing(url)),
        settleProvider("virustotal", () => fetchVirusTotalUrl(url)),
        settleProvider("urlhaus", () => lookupUrlhaus(url)),
        settleProvider("otx_url", () => fetchOtxUrl(url)),
        settleProvider("otx_domain", () => fetchOtxDomain(domain)),
        settleProvider("threatfox", () => searchThreatFox(url)),
        settleProvider("dnsdumpster", () => fetchDnsDumpster(domain)),
        settleProvider("hackertarget", () => fetchHackerTargetPhishBundle(domain, url)),
        resolveDomainIp(domain),
      ]);

    const whoisRaw = (whois.ok && whois.data) ? whois.data : {};
    const createDate =
      str(whoisRaw.create_date) ||
      str(whoisRaw.created_date) ||
      str(asObj(whoisRaw.domain_registered).create_date) ||
      null;
    const expiryDate =
      str(whoisRaw.expiry_date) ||
      str(whoisRaw.expire_date) ||
      str(asObj(whoisRaw.domain_registered).expiry_date) ||
      null;
    const registrarObj = asObj(whoisRaw.domain_registrar);
    const registrar =
      str(registrarObj.name) ||
      str(registrarObj.registrar_name) ||
      str(whoisRaw.registrar_name) ||
      str(whoisRaw.registrar) ||
      null;

    let nameservers: string[] = [];
    const ns = whoisRaw.name_servers ?? whoisRaw.nameservers;
    if (Array.isArray(ns)) {
      nameservers = ns
        .map((n) => (typeof n === "string" ? n : str(asObj(n).name_server) || ""))
        .filter(Boolean);
    }

    const ageDays = calcAgeDays(createDate);
    const ageLabel =
      ageDays == null
        ? null
        : ageDays < 30
          ? `${ageDays} days (very new)`
          : ageDays < 365
            ? `${ageDays} days`
            : `${(ageDays / 365).toFixed(1)} years`;

    const matches = phish.ok ? phish.data.matches : [];
    const top = matches[0] || null;
    const inPhishDb = phish.ok ? phish.data.found : false;

    const us = urlscan.ok ? urlscan.data : null;
    const usResult = us?.result ? asObj(us.result) : {};
    const page = asObj(usResult.page);
    const lists = asObj(usResult.lists);
    const stats = asObj(usResult.stats);
    const verdicts = asObj(usResult.verdicts);
    const overall = asObj(verdicts.overall);
    const engines = asObj(verdicts.engines);
    const urlscanMalicious = Boolean(
      overall.malicious || engines.malicious || asObj(verdicts.urlscan).malicious,
    );

    const sb = safeBrowsing.ok ? safeBrowsing.data : { safe: true, matches: [] };
    const safeBrowsingHit = !sb.safe && Array.isArray(sb.matches) && sb.matches.length > 0;

    const vtRaw = (vt.ok && vt.data) ? vt.data : {};
    const vtHasData =
      vt.ok && (vtRaw as { found?: boolean }).found !== false && Boolean((vtRaw as { data?: unknown }).data);
    const vtS = vtHasData
      ? vtStats(vtRaw as Record<string, unknown>)
      : { malicious: 0, suspicious: 0, total: 0, harmless: 0 };

    const uhRaw = (urlhaus.ok && urlhaus.data) ? urlhaus.data : {};
    const urlhausListed =
      String((uhRaw as { query_status?: string }).query_status || "").toLowerCase() === "ok" &&
      String((uhRaw as { url_status?: string }).url_status || "").toLowerCase() === "online";

    const otxUrlRaw = (otxUrl.ok && otxUrl.data) ? otxUrl.data : {};
    const otxDomainRaw = (otxDomain.ok && otxDomain.data) ? otxDomain.data : {};
    const otxPulses = Math.max(
      num(asObj(otxUrlRaw.pulse_info).count) ?? 0,
      num(asObj(otxDomainRaw.pulse_info).count) ?? 0,
    );

    const tfoxRaw = (tfox.ok && tfox.data) ? tfox.data : {};
    const tfoxData = Array.isArray(tfoxRaw.data) ? tfoxRaw.data : [];
    const threatFoxHits = tfoxData.length;

    const targetIp = resolvedIpByDns || str(page.ip);
    const [censys, maxmind] = targetIp
      ? await Promise.all([
          settleProvider("censys", () => fetchCensysHost(targetIp)),
          settleProvider("maxmind", () => fetchMaxMindGeoIp(targetIp)),
        ])
      : [
          { ok: false as const, error: "No target IP resolved for domain", provider: "censys" },
          { ok: false as const, error: "No target IP resolved for domain", provider: "maxmind" },
        ];

    const censysRaw = censys.ok ? censys.data : null;
    const censysServicesCount = censysRaw?.service_count ?? censysRaw?.open_ports?.length ?? 0;
    const censysHasRiskyPorts = Boolean(censysRaw?.has_risky_ports);
    const censysRiskyPorts = censysRaw?.risky_ports_found ?? [];

    const maxmindRaw = maxmind.ok ? maxmind.data : null;
    const dnsRaw = dnsdumpster.ok ? dnsdumpster.data : null;
    const htRaw = hackertarget.ok ? hackertarget.data : null;
    const htDns = htRaw?.dns;
    const htHosts = htRaw?.hosts;
    const htHeaders = htRaw?.headers;
    const htAxfr = htRaw?.zonetransfer;

    const dnsNoSpf = htDns ? !htDns.has_spf : dnsRaw ? !dnsRaw.has_spf : false;
    const dnsNoDmarc = htDns ? !htDns.has_dmarc : dnsRaw ? !dnsRaw.has_dmarc : false;
    const dnsSuspiciousNs = dnsRaw ? nsLooksSuspicious(dnsRaw.ns_records) : false;
    const axfrExposed = Boolean(htAxfr?.exposed);
    const missingSecurityHeaders = htHeaders?.missing_security.length ?? 0;
    const manySubdomains = (htHosts?.count ?? 0) > 20;

    const technologies: string[] = [];
    const labels = Array.isArray(lists.labels) ? lists.labels : [];
    for (const l of labels) if (typeof l === "string") technologies.push(l);
    const servers = Array.isArray(lists.servers) ? lists.servers : [];
    for (const s of servers) if (typeof s === "string") technologies.push(s);
    if (page.server && typeof page.server === "string") technologies.push(page.server);
    if (stats.uniqIPs != null) technologies.push(`${stats.uniqIPs} unique IPs`);
    if (censysServicesCount > 0) technologies.push(`Censys: ${censysServicesCount} ports detected`);
    if (dnsRaw && dnsRaw.hosting_providers.length > 0) {
      for (const hp of dnsRaw.hosting_providers.slice(0, 3)) {
        technologies.push(`DNS Host: ${hp}`);
      }
    }
    if (htHeaders?.server) technologies.push(`Server: ${htHeaders.server}`);
    if (htHosts?.count) technologies.push(`HackerTarget hosts: ${htHosts.count}`);

    const redirect_chain: string[] = [];
    const requests = Array.isArray(usResult.requests) ? (usResult.requests as Record<string, unknown>[]) : [];
    for (const r of requests.slice(0, 12)) {
      const redirs = asObj(r.response).redirects;
      const reqUrl = str(asObj(r.request).requestUrl) || str(asObj(asObj(r.request).headers).Referer);
      if (reqUrl && !redirect_chain.includes(reqUrl)) redirect_chain.push(reqUrl);
      if (Array.isArray(redirs)) {
        for (const d of redirs) {
          const u = typeof d === "string" ? d : str(asObj(d).url);
          if (u && !redirect_chain.includes(u)) redirect_chain.push(u);
        }
      }
    }
    if (redirect_chain.length === 0 && page.url) redirect_chain.push(String(page.url));

    const threat = scorePhish({
      inPhishDb,
      phishScore: top?.score != null ? Number(top.score) : null,
      domainAgeDays: ageDays,
      urlscanMalicious,
      manyRedirects: redirect_chain.length > 4,
      safeBrowsingHit,
      vtMalicious: vtS.malicious,
      vtTotal: vtS.total,
      urlhausListed,
      otxPulses,
      threatFoxHits,
      censysHasRiskyPorts,
      censysRiskyPorts,
      censysServicesCount,
      dnsNoSpf,
      dnsNoDmarc,
      dnsSuspiciousNs,
      axfrExposed,
      missingSecurityHeaders,
      manySubdomains,
    });

    let phishing_status: "clean" | "suspicious" | "phishing" = "clean";
    if (
      inPhishDb ||
      urlscanMalicious ||
      safeBrowsingHit ||
      urlhausListed ||
      threat.score >= 71
    ) {
      phishing_status = "phishing";
    } else if (threat.score >= 31) {
      phishing_status = "suspicious";
    }

    const recommendations: string[] = [];
    if (phishing_status === "phishing") {
      recommendations.push("Do not enter credentials or download files from this site.");
      recommendations.push("Block the domain at the edge / DNS filter if it targets your users.");
      recommendations.push("Report the URL to your security team and relevant threat feeds.");
    } else if (phishing_status === "suspicious") {
      recommendations.push("Verify the domain ownership and SSL certificate before trusting the site.");
      recommendations.push("Open the link in an isolated browser or sandbox if investigation is required.");
      recommendations.push("Compare registrar and age against the brand being impersonated.");
    } else {
      recommendations.push("No strong phishing indicators from correlated threat feeds.");
      recommendations.push("Continue monitoring â€” absence of hits is not a guarantee of safety.");
    }

    const result = {
      url,
      domain,
      screenshot: us?.screenshot || `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&embed=screenshot.url`,
      threat_score: threat.score,
      risk_level: threat.risk_level,
      threat,
      phishing_status,
      domain_age: ageLabel,
      domain_age_days: ageDays,
      registrar,
      registration_date: createDate,
      expiration_date: expiryDate,
      nameservers:
        nameservers.length > 0
          ? nameservers
          : htDns?.NS?.length
            ? htDns.NS
            : (dnsRaw?.ns_records.map((n) => n.host) ?? []),
      technologies: [...new Set(technologies)].slice(0, 20),
      redirect_chain: redirect_chain.slice(0, 10),
      recommendations,
      risk_breakdown: threat.breakdown,
      phishstats: {
        found: inPhishDb,
        match_count: matches.length,
        top_title: top ? str(top.title) : null,
        top_score: top?.score ?? null,
        detected_at: top ? str(top.date) || str(top.datetime) : null,
      },
      urlscan: {
        uuid: us?.uuid || null,
        status: (us as { status?: string } | null)?.status || (us?.result ? "found" : us?.uuid ? "pending" : "empty"),
        message: (us as { message?: string } | null)?.message || null,
        malicious: urlscanMalicious,
        page_title: str(page.title),
        page_ip: str(page.ip),
        country: str(page.country),
      },
      censys: censysRaw
        ? {
            target_ip: targetIp,
            service_count: censysServicesCount,
            open_ports: censysRaw.open_ports,
            risky_ports: censysRiskyPorts,
            reverse_dns: censysRaw.reverse_dns,
            asn: censysRaw.autonomous_system?.asn,
            asn_name: censysRaw.autonomous_system?.name,
          }
        : null,
      maxmind: maxmindRaw
        ? {
            target_ip: targetIp,
            country: maxmindRaw.country,
            city: maxmindRaw.city,
            region: maxmindRaw.region,
            asn: maxmindRaw.asn,
            asn_organization: maxmindRaw.asn_organization,
            security: maxmindRaw.security,
          }
        : null,
      dnsdumpster: dnsRaw
        ? {
            a_records: dnsRaw.a_records,
            mx_records: dnsRaw.mx_records,
            ns_records: dnsRaw.ns_records,
            txt_records: dnsRaw.txt_records,
            has_spf: dnsRaw.has_spf,
            has_dmarc: dnsRaw.has_dmarc,
            hosting_providers: dnsRaw.hosting_providers,
          }
        : null,
      hackertarget: htRaw,
      intel: {
        safe_browsing: { hit: safeBrowsingHit },
        virustotal: { malicious: vtS.malicious, total: vtS.total },
        urlhaus: { listed: urlhausListed },
        otx: { pulses: otxPulses },
        threatfox: { hits: threatFoxHits },
        censys: censysRaw
          ? {
              target_ip: targetIp,
              service_count: censysServicesCount,
              open_ports: censysRaw.open_ports,
              risky_ports: censysRiskyPorts,
              asn_name: censysRaw.autonomous_system?.name,
            }
          : null,
        maxmind: maxmindRaw
          ? {
              target_ip: targetIp,
              country: maxmindRaw.country,
              city: maxmindRaw.city,
              asn_organization: maxmindRaw.asn_organization,
            }
          : null,
        dnsdumpster: dnsRaw
          ? {
              has_spf: dnsRaw.has_spf,
              has_dmarc: dnsRaw.has_dmarc,
              mx_count: dnsRaw.mx_records.length,
              ns_count: dnsRaw.ns_records.length,
              hosting_providers: dnsRaw.hosting_providers,
            }
          : null,
        hackertarget: htRaw
          ? {
              a_count: htDns?.A.length ?? 0,
              mx_count: htDns?.MX.length ?? 0,
              ns_count: htDns?.NS.length ?? 0,
              host_count: htHosts?.count ?? 0,
              axfr_exposed: axfrExposed,
              missing_security_headers: htHeaders?.missing_security ?? [],
            }
          : null,
      },
      provider_errors: {
        phishstats: phish.ok ? null : phish.error,
        whoisfreaks: whois.ok ? null : whois.error,
        urlscan: urlscan.ok ? null : urlscan.error,
        safe_browsing: safeBrowsing.ok ? null : safeBrowsing.error,
        virustotal: vt.ok ? null : vt.error,
        urlhaus: urlhaus.ok ? null : urlhaus.error,
        otx: otxUrl.ok || otxDomain.ok ? null : otxUrl.error || otxDomain.error,
        threatfox: tfox.ok ? null : tfox.error,
        censys: censys.ok ? null : censys.error,
        maxmind: maxmind.ok ? null : maxmind.error,
        dnsdumpster: dnsdumpster.ok ? null : dnsdumpster.error,
        hackertarget: hackertarget.ok ? null : hackertarget.error,
      },
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/phishing-intel]", e);
    return sendError(res, e);
  }
}

