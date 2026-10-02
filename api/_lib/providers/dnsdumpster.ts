import { requireEnv, parseJsonSafe, safeFetch } from "../http.js";

export type DnsDumpsterRecord = {
  host: string;
  ip?: string;
  asn?: string;
  asn_name?: string;
  country?: string;
  country_code?: string;
  ptr?: string;
};

export type DnsDumpsterData = {
  domain: string;
  // A records (direct IPs)
  a_records: DnsDumpsterRecord[];
  // MX records (mail servers)
  mx_records: DnsDumpsterRecord[];
  // NS records (name servers)
  ns_records: DnsDumpsterRecord[];
  // TXT records (SPF, DKIM, DMARC, etc.)
  txt_records: string[];
  // CNAME chains
  cname_records: DnsDumpsterRecord[];
  // Security-relevant flags derived from the DNS records
  has_spf: boolean;
  has_dmarc: boolean;
  has_dkim: boolean;
  spf_value: string | null;
  dmarc_value: string | null;
  // Unique hosting providers from A/MX records
  hosting_providers: string[];
  // Total A record count (can be large for popular domains)
  total_a_records: number;
  raw?: Record<string, unknown>;
};

/** Suspicious / free / bulletproof NS providers that inflate the threat score */
const SUSPICIOUS_NS_KEYWORDS = [
  "freenom",
  "dot.tk",
  "dot.ml",
  "dot.cf",
  "dot.ga",
  "namecheap",
  "dynadot",
  "registrar-servers",
  "bigrock",
  "above.com",
  "parkingcrew",
  "sedo",
  "bodis",
  "perfectip",
  "voxility",
  "serverius",
];

function extractRecords(arr: unknown[]): DnsDumpsterRecord[] {
  return arr.map((item) => {
    const r = item as Record<string, unknown>;
    const ips = Array.isArray(r.ips) ? (r.ips as Record<string, unknown>[]) : [];
    const firstIp = ips[0] ?? {};
    return {
      host: String(r.host ?? ""),
      ip: String(firstIp.ip ?? ""),
      asn: String(firstIp.asn ?? ""),
      asn_name: String(firstIp.asn_name ?? ""),
      country: String(firstIp.country ?? ""),
      country_code: String(firstIp.country_code ?? ""),
      ptr: String(firstIp.ptr ?? ""),
    };
  });
}

export async function fetchDnsDumpster(domain: string): Promise<DnsDumpsterData> {
  const apiKey = requireEnv("DNSDUMPSTER_API_KEY");
  const url = `https://api.dnsdumpster.com/domain/${encodeURIComponent(domain)}`;

  const res = await safeFetch(url, {
    headers: {
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
  });

  const data = (await parseJsonSafe(res)) as Record<string, unknown>;

  if (!res.ok) {
    const detail =
      (data as { detail?: string })?.detail ||
      (data as { message?: string })?.message ||
      `DNSDumpster HTTP ${res.status}`;
    throw new Error(detail);
  }

  // A records
  const rawA = Array.isArray(data.a) ? (data.a as unknown[]) : [];
  const a_records = extractRecords(rawA);
  const total_a_records =
    typeof data.total_a_recs === "number" ? (data.total_a_recs as number) : a_records.length;

  // MX records
  const rawMx = Array.isArray(data.mx) ? (data.mx as unknown[]) : [];
  const mx_records = extractRecords(rawMx);

  // NS records
  const rawNs = Array.isArray(data.ns) ? (data.ns as unknown[]) : [];
  const ns_records = extractRecords(rawNs);

  // TXT records (array of raw strings)
  const rawTxt = Array.isArray(data.txt) ? (data.txt as unknown[]) : [];
  const txt_records = rawTxt
    .map((t) => (typeof t === "string" ? t : String((t as Record<string, unknown>)?.value ?? "")))
    .filter(Boolean);

  // CNAME records
  const rawCname = Array.isArray(data.cname) ? (data.cname as unknown[]) : [];
  const cname_records = extractRecords(rawCname);

  // Parse SPF / DMARC / DKIM from TXT records
  const spfRecord = txt_records.find((t) => t.toLowerCase().includes("v=spf1")) || null;
  const dmarcRecord = txt_records.find((t) => t.toLowerCase().includes("v=dmarc1")) || null;
  const hasDkim = txt_records.some(
    (t) =>
      t.toLowerCase().includes("v=dkim1") ||
      t.toLowerCase().includes("k=rsa") ||
      t.toLowerCase().includes("dkim"),
  );

  // Collect unique ASN / hosting providers from A + MX
  const providerSet = new Set<string>();
  for (const rec of [...a_records, ...mx_records]) {
    if (rec.asn_name && rec.asn_name !== "undefined") providerSet.add(rec.asn_name);
  }
  const hosting_providers = [...providerSet].slice(0, 10);

  return {
    domain,
    a_records: a_records.slice(0, 30), // cap at 30 to avoid huge payloads
    mx_records,
    ns_records,
    txt_records,
    cname_records,
    has_spf: Boolean(spfRecord),
    has_dmarc: Boolean(dmarcRecord),
    has_dkim: hasDkim,
    spf_value: spfRecord,
    dmarc_value: dmarcRecord,
    hosting_providers,
    total_a_records,
    raw: data,
  };
}

/** Returns true if any NS host looks like a suspicious provider */
export function nsLooksSuspicious(ns_records: DnsDumpsterRecord[]): boolean {
  for (const ns of ns_records) {
    const host = (ns.host || "").toLowerCase();
    if (SUSPICIOUS_NS_KEYWORDS.some((kw) => host.includes(kw))) return true;
  }
  return false;
}
