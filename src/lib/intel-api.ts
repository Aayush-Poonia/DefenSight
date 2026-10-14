import { invokeFn } from "./api";
import type { ThreatScore } from "./threat-score";

export type IpIntelResult = {
  ip: string;
  country: string | null;
  region: string | null;
  city?: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  asn: string | null;
  isp: string | null;
  organization: string | null;
  reverse_dns?: string | null;
  reverse_ip_domains?: string[];
  hosting_provider: string | null;
  ip_type: string;
  security: Record<string, boolean>;
  threat_score: number;
  risk_level: string;
  threat: ThreatScore;
  summary: Record<string, unknown>;
  intel?: Record<string, unknown>;
  censys?: Record<string, unknown> | null;
  maxmind?: Record<string, unknown> | null;
  sources: Record<string, { ok?: boolean; error?: string }>;
};

export type PhoneIntelResult = {
  phone: string;
  valid: boolean | null;
  country: string | null;
  carrier: string | null;
  line_type: string | null;
  international_format: string | null;
  local_format: string | null;
  region: string | null;
  validation_score: number;
  threat_score: number;
  risk_level: string;
  threat: ThreatScore;
  number_info: Record<string, unknown>;
  sources: Record<string, unknown>;
};

export type EmailIntelResult = {
  email: string;
  disposable: boolean | null;
  reputation: string | null;
  deliverability: string | null;
  domain: string | null;
  provider?: string | null;
  mx_records: unknown;
  risk_level: string | null;
  validation_status: string | null;
  threat_score: number;
  threat: ThreatScore;
  extras: Record<string, unknown>;
  sources: Record<string, unknown>;
};

export type FileScanResult = {
  scan_status: string;
  verdict: string;
  safe: boolean;
  detection_results: unknown[];
  threat_score: number;
  risk_level: string;
  threat: ThreatScore;
  file_information: Record<string, unknown>;
  intel?: Record<string, unknown>;
  sources?: Record<string, unknown>;
};

export type PhishIntelResult = {
  url: string;
  domain: string;
  screenshot: string | null;
  threat_score: number;
  risk_level: string;
  threat: ThreatScore;
  phishing_status: "clean" | "suspicious" | "phishing";
  domain_age: string | null;
  domain_age_days: number | null;
  registrar: string | null;
  registration_date: string | null;
  expiration_date: string | null;
  nameservers: string[];
  technologies: string[];
  redirect_chain: string[];
  recommendations: string[];
  risk_breakdown: { factor: string; points: number }[];
  phishstats: Record<string, unknown>;
  urlscan: Record<string, unknown>;
  censys?: Record<string, unknown> | null;
  maxmind?: Record<string, unknown> | null;
  dnsdumpster?: Record<string, unknown> | null;
  hackertarget?: Record<string, unknown> | null;
  intel?: Record<string, unknown>;
  provider_errors?: Record<string, string | null>;
};

export type HackerTargetResult = {
  tool: string;
  target: string;
  parsed: unknown;
  raw: string;
};

/* ------------------------------------------------------------------ */
/*  Vulnerability Intelligence                                         */
/* ------------------------------------------------------------------ */

export type VulnAffectedRange = {
  cpe: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
  vulnerable: boolean;
};

export type VulnReference = { url: string; tags?: string[]; source?: string };

export type VulnerabilityRecord = {
  cve_id: string;
  description: string | null;
  cvss_score: number | null;
  severity: string | null;
  cvss_version: string | null;
  cvss_vector: string | null;
  published: string | null;
  last_modified: string | null;
  status: string | null;
  cwes: string[];
  references: VulnReference[];
  affected_ranges: VulnAffectedRange[];
  in_cisa_kev: boolean;
  cisa_kev: unknown;
  epss: { cve: string; epss: string; percentile: string; date: string } | null;
  epss_score: number | null;
  epss_percentile: number | null;
  osv_aliases: string[];
  osv_id: string | null;
  risk_score: number;
  risk_level: string;
};

export type VulnSearchResult = {
  query: string;
  is_cve: boolean;
  total_results: number;
  results: VulnerabilityRecord[];
  sources: Record<string, { ok?: boolean; error?: string }>;
};

export type VulnDetailsResult = {
  result: VulnerabilityRecord;
  osv: unknown;
  sources: Record<string, { ok?: boolean; error?: string }>;
};

export type VulnPackageResult = {
  package: { name: string; ecosystem: string; version?: string };
  vulns: Array<{
    id: string;
    summary: string | null;
    details: string | null;
    aliases: string[];
    severity: Array<{ type: string; score: string }>;
    cvss_score: number | null;
    cvss_severity: string | null;
    published: string | null;
    modified: string | null;
    references: Array<{ type: string; url: string }>;
    affected: unknown[];
    in_cisa_kev: boolean;
    cisa_kev: unknown;
    epss_score: number | null;
    risk_score: number;
    risk_level: string;
  }>;
  source: { ok?: boolean; error?: string };
};

export type VulnPackageScanResult = {
  results: VulnPackageResult[];
  sources: Record<string, { ok?: boolean; error?: string }>;
};

export type VulnRecentResult = {
  days: number;
  total_results: number;
  results: VulnerabilityRecord[];
  sources: Record<string, { ok?: boolean; error?: string }>;
};

export const intelApi = {
  ip: (ip: string) => invokeFn<IpIntelResult>("ip", { ip }),
  phone: (phone: string, country?: string) => invokeFn<PhoneIntelResult>("phone", { phone, country }),
  email: (email: string) => invokeFn<EmailIntelResult>("email", { email }),
  file: (payload: { filename: string; contentBase64: string; contentType: string }) =>
    invokeFn<FileScanResult>("file", payload),
  phishingIntel: (url: string) => invokeFn<PhishIntelResult>("phishing-intel", { url }),
  hackertarget: (tool: string, target: string) =>
    invokeFn<HackerTargetResult>("hackertarget", { tool, target }),
  vuln: {
    search: (query: string, limit = 20) =>
      invokeFn<VulnSearchResult>("vulnerability", { action: "search", query, limit }),
    details: (cveId: string) =>
      invokeFn<VulnDetailsResult>("vulnerability", { action: "details", cve_id: cveId }),
    packageScan: (packages: Array<{ name: string; ecosystem: string; version?: string }>) =>
      invokeFn<VulnPackageScanResult>("vulnerability", { action: "package-scan", packages }),
    recent: (limit = 20, days = 7) =>
      invokeFn<VulnRecentResult>("vulnerability", { action: "recent", limit, days }),
  },
};
