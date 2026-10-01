import { invokeFn } from "./api";
import type { ThreatScore } from "./threat-score";

export type IpIntelResult = {
  ip: string;
  country: string | null;
  region: string | null;
  asn: string | null;
  isp: string | null;
  organization: string | null;
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
  sources: Record<string, unknown>;
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
  intel?: Record<string, unknown>;
  provider_errors?: Record<string, string | null>;
};

export const intelApi = {
  ip: (ip: string) => invokeFn<IpIntelResult>("ip", { ip }),
  phone: (phone: string, country?: string) => invokeFn<PhoneIntelResult>("phone", { phone, country }),
  email: (email: string) => invokeFn<EmailIntelResult>("email", { email }),
  file: (payload: { filename: string; contentBase64: string; contentType: string }) =>
    invokeFn<FileScanResult>("file", payload),
  phishingIntel: (url: string) => invokeFn<PhishIntelResult>("phishing-intel", { url }),
};
