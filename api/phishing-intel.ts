import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors";
import { settleProvider } from "./_lib/http";
import { lookupUrlhaus, searchThreatFox } from "./_lib/providers/abusech";
import { fetchOtxDomain, fetchOtxUrl } from "./_lib/providers/otx";
import { fetchPhishStats } from "./_lib/providers/phishstats";
import { checkSafeBrowsing } from "./_lib/providers/safebrowsing";
import { submitAndFetchUrlscan } from "./_lib/providers/urlscan";
import { fetchVirusTotalUrl, vtStats } from "./_lib/providers/virustotal";
import { fetchWhoisFreaks } from "./_lib/providers/whoisfreaks";
import { scorePhish } from "./_lib/threat-score";
import { validateUrl } from "./_lib/validators";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const url = validateUrl(req.body?.url);
    const domain = extractDomain(url);

    const [phish, whois, urlscan, safeBrowsing, vt, urlhaus, otxUrl, otxDomain, tfox] =
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

    const technologies: string[] = [];
    const labels = Array.isArray(lists.labels) ? lists.labels : [];
    for (const l of labels) if (typeof l === "string") technologies.push(l);
    const servers = Array.isArray(lists.servers) ? lists.servers : [];
    for (const s of servers) if (typeof s === "string") technologies.push(s);
    if (page.server && typeof page.server === "string") technologies.push(page.server);
    if (stats.uniqIPs != null) technologies.push(`${stats.uniqIPs} unique IPs`);

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
      recommendations.push("Continue monitoring — absence of hits is not a guarantee of safety.");
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
      nameservers,
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
      intel: {
        safe_browsing: { hit: safeBrowsingHit },
        virustotal: { malicious: vtS.malicious, total: vtS.total },
        urlhaus: { listed: urlhausListed },
        otx: { pulses: otxPulses },
        threatfox: { hits: threatFoxHits },
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
      },
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/phishing-intel]", e);
    return sendError(res, e);
  }
}
