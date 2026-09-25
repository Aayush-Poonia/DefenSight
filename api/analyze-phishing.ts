import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, setCors } from "./_lib/cors";

type WhoisInfo = {
  domain?: string;
  registrar?: string;
  createdDate?: string;
  updatedDate?: string;
  expiresDate?: string;
  ageDays?: number | null;
  registrantCountry?: string;
  nameServers?: string[];
  error?: string;
  details?: Record<string, string | number>;
  contacts?: Record<string, Record<string, string | number>>;
};

async function fetchWhois(host: string): Promise<WhoisInfo | null> {
  const key = process.env.WHOISXML_API_KEY;
  if (!key) return null;
  const parts = host.split(".");
  const domain = parts.length > 2 ? parts.slice(-2).join(".") : host;
  try {
    const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${encodeURIComponent(key)}&domainName=${encodeURIComponent(domain)}&outputFormat=JSON`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { domain, error: `WHOIS HTTP ${res.status}` };
    const data = await res.json();
    const rec = data?.WhoisRecord;
    if (!rec) return { domain, error: "No WHOIS record" };
    const created = rec.createdDate || rec.registryData?.createdDate;
    const updated = rec.updatedDate || rec.registryData?.updatedDate;
    const expires = rec.expiresDate || rec.registryData?.expiresDate;
    let ageDays: number | null = null;
    if (created) {
      const ms = Date.now() - new Date(created).getTime();
      if (!Number.isNaN(ms)) ageDays = Math.max(0, Math.floor(ms / 86400000));
    }
    const ns = rec.nameServers?.hostNames || rec.registryData?.nameServers?.hostNames || [];
    const details: Record<string, string | number> = {};
    const add = (k: string, v: unknown) => {
      if (v === undefined || v === null) return;
      if (typeof v === "string" && v.trim() === "") return;
      details[k] = v as string | number;
    };
    add("Domain Name", rec.domainName);
    add("Registrar", rec.registrarName);
    add("Registrar IANA ID", rec.registrarIANAID);
    add("Registry Domain ID", rec.registryData?.registryDomainId || rec.registryData?.domainId);
    add("WHOIS Server", rec.registryData?.whoisServer || rec.whoisServer);
    add("Created", created);
    add("Updated", updated);
    add("Expires", expires);
    add("Estimated Domain Age (days)", rec.estimatedDomainAge);
    add("Status", Array.isArray(rec.status) ? rec.status.join(", ") : rec.status);
    add("DNSSEC", rec.registryData?.dnssec);

    const contactKeys = ["registrant", "administrativeContact", "technicalContact", "billingContact"] as const;
    const contacts: Record<string, Record<string, string | number>> = {};
    for (const k of contactKeys) {
      const c = rec[k] || rec.registryData?.[k];
      if (!c) continue;
      const flat: Record<string, string | number> = {};
      const fadd = (label: string, v: unknown) => {
        if (v === undefined || v === null) return;
        if (typeof v === "string" && v.trim() === "") return;
        flat[label] = v as string | number;
      };
      fadd("Name", c.name);
      fadd("Organization", c.organization);
      fadd("Email", c.email);
      fadd("Telephone", c.telephone);
      fadd("Fax", c.fax);
      fadd("Street", c.street1 || c.street);
      fadd("City", c.city);
      fadd("State", c.state);
      fadd("Postal Code", c.postalCode);
      fadd("Country", c.country);
      if (Object.keys(flat).length > 0) contacts[k] = flat;
    }

    return {
      domain: rec.domainName || domain,
      registrar: rec.registrarName || rec.registryData?.registrarName,
      createdDate: created,
      updatedDate: updated,
      expiresDate: expires,
      ageDays,
      registrantCountry: rec.registrant?.country || rec.registryData?.registrant?.country,
      nameServers: Array.isArray(ns) ? ns.slice(0, 6) : [],
      details,
      contacts,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "WHOIS lookup failed";
    return { domain, error: msg };
  }
}

const SUSPICIOUS_TLDS = new Set([
  "zip", "mov", "xyz", "top", "club", "click", "country", "stream", "gq", "tk",
  "ml", "cf", "ga", "work", "loan", "men", "racing", "review", "support", "fit",
]);
const BRAND_KEYWORDS = [
  "paypal", "apple", "icloud", "microsoft", "office365", "outlook", "google",
  "gmail", "amazon", "netflix", "facebook", "instagram", "whatsapp", "bank",
  "secure", "login", "verify", "wallet", "binance", "coinbase", "metamask",
  "support", "update", "account", "signin", "auth",
];
const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy",
]);

function extractFeatures(rawUrl: string) {
  let normalized = rawUrl.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = "http://" + normalized;
  let u: URL;
  try {
    u = new URL(normalized);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname + u.search + u.hash;
  const parts = host.split(".");
  const tld = parts[parts.length - 1] || "";
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  const brandHits = BRAND_KEYWORDS.filter((b) => host.includes(b) || path.toLowerCase().includes(b));
  const punycode = host.startsWith("xn--") || parts.some((p) => p.startsWith("xn--"));
  return {
    url: u.toString(),
    host,
    scheme: u.protocol.replace(":", ""),
    https: u.protocol === "https:",
    urlLength: rawUrl.length,
    hostLength: host.length,
    pathLength: path.length,
    numDots: (host.match(/\./g) || []).length,
    numHyphens: (host.match(/-/g) || []).length,
    numDigitsHost: (host.match(/\d/g) || []).length,
    numSubdomains: Math.max(0, parts.length - 2),
    hasAtSymbol: rawUrl.includes("@"),
    hasDoubleSlashInPath: /\/\//.test(u.pathname),
    isIp,
    suspiciousTld: SUSPICIOUS_TLDS.has(tld),
    tld,
    isShortener: SHORTENERS.has(host),
    punycode,
    brandKeywords: brandHits,
    portInUrl: !!u.port,
    queryParams: Array.from(u.searchParams.keys()).length,
    suspiciousChars: (rawUrl.match(/[%]/g) || []).length,
  };
}

type Features = NonNullable<ReturnType<typeof extractFeatures>>;

function ruleScore(f: Features) {
  let score = 0;
  const reasons: string[] = [];
  const add = (n: number, why: string) => {
    score += n;
    reasons.push(why);
  };
  if (!f.https) add(15, "Uses HTTP instead of HTTPS");
  if (f.isIp) add(25, "Uses raw IP address as host");
  if (f.hasAtSymbol) add(20, "Contains '@' symbol — common URL spoof trick");
  if (f.hasDoubleSlashInPath) add(8, "Path contains '//' redirect pattern");
  if (f.urlLength > 90) add(10, `Unusually long URL (${f.urlLength} chars)`);
  if (f.numHyphens >= 3) add(10, `Many hyphens in host (${f.numHyphens})`);
  if (f.numSubdomains >= 3) add(10, `Deep subdomain nesting (${f.numSubdomains})`);
  if (f.numDigitsHost >= 4) add(8, `Many digits in host (${f.numDigitsHost})`);
  if (f.suspiciousTld) add(15, `Suspicious TLD: .${f.tld}`);
  if (f.isShortener) add(10, "URL shortener — destination hidden");
  if (f.punycode) add(15, "Punycode (xn--) host — possible homograph attack");
  if (f.brandKeywords.length > 0) add(12, `Brand keyword in URL: ${f.brandKeywords.join(", ")}`);
  if (f.portInUrl) add(6, `Non-standard port (${f.host})`);
  if (f.suspiciousChars > 4) add(6, "Heavy URL-encoding");
  return { score: Math.min(100, score), reasons };
}

const SYSTEM_PROMPT = `You are a phishing-detection analyst combining classical URL feature engineering with reasoning.
You will be given a URL and pre-extracted lexical features plus a heuristic rule-based score.
Decide whether the URL is likely a phishing site.
Return a calibrated verdict via the report_phishing tool.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "report_phishing",
    description: "Return structured phishing analysis",
    parameters: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["safe", "suspicious", "phishing"] },
        confidence: { type: "number" },
        risk_score: { type: "number" },
        summary: { type: "string" },
        red_flags: { type: "array", items: { type: "string" } },
        safe_signals: { type: "array", items: { type: "string" } },
        impersonation_target: {
          type: "string",
          description: "Brand being impersonated, or 'none' if not applicable. Always a string, never null.",
        },
        category: {
          type: "string",
          enum: ["credential_harvest", "scam", "malware", "ad_redirect", "legitimate", "unknown"],
        },
        recommendation: { type: "string" },
      },
      required: [
        "verdict",
        "confidence",
        "risk_score",
        "summary",
        "red_flags",
        "safe_signals",
        "category",
        "recommendation",
      ],
    },
  },
};

function buildBody(
  model: string,
  url: string,
  features: Features,
  rule: { score: number; reasons: string[] },
  whois: WhoisInfo | null,
) {
  return {
    model,
    messages: [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          "\n\nIMPORTANT: impersonation_target must be a STRING (use 'none' if no brand is impersonated), never null.",
      },
      {
        role: "user",
        content: `URL: ${url}\n\nHeuristic rule score: ${rule.score}/100\nHeuristic reasons:\n${rule.reasons.map((r) => `- ${r}`).join("\n") || "- none"}\n\nExtracted features (JSON):\n${JSON.stringify(features, null, 2)}\n\nWHOIS enrichment (JSON, may be null/partial):\n${JSON.stringify(whois, null, 2)}\n\nNote: very young domains (ageDays < 90), missing registrar info, or privacy-protected registrants on brand-impersonating hosts strongly indicate phishing.`,
      },
    ],
    tools: [TOOL_DEF],
    tool_choice: { type: "function", function: { name: "report_phishing" } },
  };
}

async function callGroq(
  url: string,
  features: Features,
  rule: { score: number; reasons: string[] },
  whois: WhoisInfo | null,
) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildBody("llama-3.3-70b-versatile", url, features, rule, whois)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) throw new Error("Groq: no tool output");
  const out = JSON.parse(tc.function.arguments);
  if (!out.impersonation_target || typeof out.impersonation_target !== "string") out.impersonation_target = "none";
  if (!Array.isArray(out.red_flags)) out.red_flags = [];
  if (!Array.isArray(out.safe_signals)) out.safe_signals = [];
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const { url } = req.body ?? {};
    if (typeof url !== "string" || url.length < 4 || url.length > 2048) {
      setCors(res);
      return res.status(400).json({ error: "Invalid URL." });
    }

    const features = extractFeatures(url);
    if (!features) {
      setCors(res);
      return res.status(400).json({ error: "Invalid URL — please enter a valid web address." });
    }

    const rule = ruleScore(features);
    const whois = features.isIp ? null : await fetchWhois(features.host).catch(() => null);
    if (whois && !whois.error) {
      if (typeof whois.ageDays === "number" && whois.ageDays < 90) {
        rule.score = Math.min(100, rule.score + 15);
        rule.reasons.push(`Domain registered only ${whois.ageDays} days ago (very young)`);
      } else if (typeof whois.ageDays === "number" && whois.ageDays < 365) {
        rule.score = Math.min(100, rule.score + 6);
        rule.reasons.push(`Domain less than 1 year old (${whois.ageDays} days)`);
      }
    }

    const result = await callGroq(features.url, features, rule, whois);
    setCors(res);
    return res.status(200).json({ ...result, _provider: "Groq", features, rule, whois });
  } catch (e) {
    console.error("[analyze-phishing]", e);
    setCors(res);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
