import { ApiError, optionalEnv, safeFetch } from "../http.js";

export const HACKERTARGET_TOOLS = {
  dnslookup: { path: "dnslookup", json: true },
  hostsearch: { path: "hostsearch" },
  whois: { path: "whois" },
  reversedns: { path: "reversedns" },
  reverseiplookup: { path: "reverseiplookup" },
  geoip: { path: "geoip" },
  aslookup: { path: "aslookup" },
  httpheaders: { path: "httpheaders" },
  pagelinks: { path: "pagelinks" },
  bannerlookup: { path: "bannerlookup" },
  ping: { path: "ping" },
  mtr: { path: "mtr" },
  subnetcalc: { path: "subnetcalc" },
  zonetransfer: { path: "zonetransfer" },
  analyticslookup: { path: "analyticslookup" },
  findshareddns: { path: "findshareddns" },
  nmap: { path: "nmap" },
  nmap_udp: { path: "nmap", extra: { udp: "1" } },
} as const;

export type HackerTargetTool = keyof typeof HACKERTARGET_TOOLS;

function isQuotaOrError(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("api count exceeded") || (t.includes("quota") && t.includes("exceed"))) {
    return "HackerTarget daily quota exceeded (free tier is ~50 calls/day)";
  }
  if (t.includes("error invalid") || t.includes("error check your search")) return text.trim().slice(0, 200);
  if (t.startsWith("error")) return text.trim().slice(0, 240);
  return null;
}

function parseKv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim().toLowerCase().replace(/\s+/g, "_");
    const v = line.slice(i + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

function lines(text: string, limit = 80): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^error\b/i.test(l))
    .slice(0, limit);
}

function numFrom(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function asStrArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

let lastHtCall = 0;
async function throttleHt() {
  const wait = 600 - (Date.now() - lastHtCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHtCall = Date.now();
}

export async function hackertargetRequest(
  tool: HackerTargetTool,
  q: string,
): Promise<{ text: string; json: unknown | null }> {
  await throttleHt();
  const spec = HACKERTARGET_TOOLS[tool];
  const params = new URLSearchParams({ q });
  if ("json" in spec && spec.json) params.set("output", "json");
  if ("extra" in spec && spec.extra) {
    for (const [k, v] of Object.entries(spec.extra)) params.set(k, v);
  }
  const key = optionalEnv("HACKERTARGET_API_KEY");
  if (key) params.set("apikey", key);

  const url = `https://api.hackertarget.com/${spec.path}/?${params.toString()}`;
  const res = await safeFetch(url, {}, 22000);
  const rawText = await res.text().catch(() => "");
  const quotaErr = isQuotaOrError(rawText);
  if (!res.ok) {
    throw new ApiError(quotaErr || `HackerTarget ${tool} HTTP ${res.status}`, res.status === 429 ? 429 : 502);
  }
  if (quotaErr && !rawText.trim().startsWith("{") && !rawText.trim().startsWith("[")) {
    throw new ApiError(quotaErr, 429);
  }

  let json: unknown | null = null;
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      json = JSON.parse(trimmed);
    } catch {
      json = null;
    }
  }
  return { text: rawText.slice(0, 12000), json };
}

export type HtGeo = {
  ip: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  isp: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function fetchHtGeoIp(ip: string): Promise<HtGeo> {
  const { text, json } = await hackertargetRequest("geoip", ip);
  const obj = json && typeof json === "object" ? (json as Record<string, unknown>) : parseKv(text);
  return {
    ip: String(obj.ip || obj.ip_address || ip),
    country: (obj.country as string) || null,
    city: (obj.city as string) || null,
    state: (obj.state as string) || (obj.region as string) || null,
    isp: (obj.isp as string) || (obj.org as string) || null,
    latitude: numFrom(obj.latitude ?? obj.lat),
    longitude: numFrom(obj.longitude ?? obj.lon ?? obj.lng),
  };
}

export type HtDnsRecords = {
  A: string[];
  AAAA: string[];
  MX: string[];
  NS: string[];
  TXT: string[];
  CNAME: string[];
  SOA: string[];
  has_spf: boolean;
  has_dmarc: boolean;
};

export async function fetchHtDnsLookup(domain: string): Promise<HtDnsRecords> {
  const { text, json } = await hackertargetRequest("dnslookup", domain);
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const o = json as Record<string, unknown>;
    const TXT = asStrArr(o.TXT);
    return {
      A: asStrArr(o.A),
      AAAA: asStrArr(o.AAAA),
      MX: asStrArr(o.MX),
      NS: asStrArr(o.NS),
      TXT,
      CNAME: asStrArr(o.CNAME),
      SOA: asStrArr(o.SOA),
      has_spf: TXT.some((t) => /v=spf1/i.test(t)),
      has_dmarc: TXT.some((t) => /v=DMARC1/i.test(t)),
    };
  }
  const rec: HtDnsRecords = { A: [], AAAA: [], MX: [], NS: [], TXT: [], CNAME: [], SOA: [], has_spf: false, has_dmarc: false };
  for (const line of lines(text, 200)) {
    const m = line.match(/^(\S+)\s+(?:IN\s+)?(A|AAAA|MX|NS|TXT|CNAME|SOA)\s+(.+)$/i);
    if (!m) continue;
    const type = m[2].toUpperCase() as keyof Omit<HtDnsRecords, "has_spf" | "has_dmarc">;
    const val = m[3].replace(/^"|"$/g, "").trim();
    if (Array.isArray(rec[type])) rec[type].push(val);
  }
  rec.has_spf = rec.TXT.some((t) => /v=spf1/i.test(t));
  rec.has_dmarc = rec.TXT.some((t) => /v=DMARC1/i.test(t));
  return rec;
}

export async function fetchHtHostSearch(domain: string) {
  const { text } = await hackertargetRequest("hostsearch", domain);
  const hosts = lines(text, 50).map((line) => {
    const [host, ip] = line.split(",");
    return { host: (host || line).trim(), ip: (ip || "").trim() || null };
  });
  return { hosts, count: hosts.length };
}

export async function fetchHtReverseDns(ip: string) {
  const { text } = await hackertargetRequest("reversedns", ip);
  const raw = lines(text, 20);
  const first = raw[0] || "";
  const parts = first.split(/\s+/);
  const hostname = parts.length >= 2 ? parts.slice(1).join(" ") : first || null;
  return { hostname: hostname && hostname !== ip ? hostname : null, raw };
}

export async function fetchHtReverseIp(ip: string) {
  const { text } = await hackertargetRequest("reverseiplookup", ip);
  const domains = lines(text, 40);
  return { domains, count: domains.length };
}

export async function fetchHtAsLookup(ip: string) {
  const { text } = await hackertargetRequest("aslookup", ip);
  const kv = parseKv(text);
  const rawLines = lines(text, 40);
  const asn = kv.asn || (text.match(/AS\d+/i) || [])[0] || null;
  return {
    asn,
    org: kv.org || kv.organization || kv.asname || null,
    ranges: rawLines.filter((l) => /\d+\.\d+\.\d+\.\d+\/\d+/.test(l)).slice(0, 20),
    raw: text.slice(0, 3000),
  };
}

export async function fetchHtHttpHeaders(target: string) {
  const { text } = await hackertargetRequest("httpheaders", target);
  const headers = parseKv(text);
  const need = ["strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options"];
  const missing_security = need.filter((h) => !Object.keys(headers).includes(h));
  return { headers, server: headers.server || null, missing_security, raw: text.slice(0, 4000) };
}

export async function fetchHtZoneTransfer(domain: string) {
  const { text } = await hackertargetRequest("zonetransfer", domain);
  const lower = text.toLowerCase();
  const failed = /failed|refused|not allowed|transfer not/i.test(lower);
  const exposed = !failed && (lower.includes("axfr") || text.split("\n").length > 10);
  return {
    exposed,
    summary: exposed ? "Possible DNS zone transfer (AXFR) data returned" : "AXFR does not appear open",
    records: lines(text, 25),
  };
}

export async function fetchHackerTargetIpBundle(ip: string) {
  const [geo, rdns, revip, asn] = await Promise.all([
    fetchHtGeoIp(ip).catch(() => null),
    fetchHtReverseDns(ip).catch(() => null),
    fetchHtReverseIp(ip).catch(() => null),
    fetchHtAsLookup(ip).catch(() => null),
  ]);
  if (!geo && !rdns && !revip && !asn) throw new ApiError("HackerTarget IP lookups failed", 502);
  return { geo, reverse_dns: rdns, reverse_ip: revip, asn };
}

export async function fetchHackerTargetPhishBundle(domain: string, url: string) {
  const [dns, hosts, headers, axfr] = await Promise.all([
    fetchHtDnsLookup(domain).catch(() => null),
    fetchHtHostSearch(domain).catch(() => null),
    fetchHtHttpHeaders(url).catch(() => null),
    fetchHtZoneTransfer(domain).catch(() => null),
  ]);
  if (!dns && !hosts && !headers && !axfr) throw new ApiError("HackerTarget domain lookups failed", 502);
  return { dns, hosts, headers, zonetransfer: axfr };
}

export async function runHackerTargetTool(tool: HackerTargetTool, target: string) {
  const { text, json } = await hackertargetRequest(tool, target);
  let parsed: unknown = json;
  if (!parsed) {
    if (tool === "geoip") parsed = parseKv(text);
    else if (tool === "hostsearch") {
      parsed = lines(text, 80).map((line) => {
        const [host, ip] = line.split(",");
        return { host: (host || line).trim(), ip: (ip || "").trim() || null };
      });
    } else if (
      tool === "pagelinks" ||
      tool === "findshareddns" ||
      tool === "analyticslookup" ||
      tool === "reverseiplookup"
    ) {
      const items = lines(text, 80);
      parsed = { items, count: items.length };
    } else {
      parsed = { lines: lines(text, 120) };
    }
  }
  return { tool, target, parsed, raw: text };
}
