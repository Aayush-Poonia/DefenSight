export type RiskLevel = "low" | "medium" | "high";

export type ScoreBreakdownItem = {
  factor: string;
  points: number;
};

export type ThreatScore = {
  score: number;
  risk_level: RiskLevel;
  reasons: string[];
  breakdown: ScoreBreakdownItem[];
};

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function riskFromScore(score: number): RiskLevel {
  if (score <= 30) return "low";
  if (score <= 70) return "medium";
  return "high";
}

export function buildThreat(
  breakdown: ScoreBreakdownItem[],
  base = 5,
): ThreatScore {
  const score = clampScore(base + breakdown.reduce((s, b) => s + b.points, 0));
  return {
    score,
    risk_level: riskFromScore(score),
    reasons: breakdown.filter((b) => b.points > 0).map((b) => b.factor),
    breakdown: breakdown.filter((b) => b.points > 0),
  };
}

export function riskStyles(level: RiskLevel | string | null | undefined) {
  if (level === "high") {
    return {
      text: "text-destructive",
      bg: "bg-destructive/10",
      ring: "ring-destructive/30",
      bar: "bg-destructive",
      label: "High Risk",
    };
  }
  if (level === "medium") {
    return {
      text: "text-amber-500",
      bg: "bg-amber-500/10",
      ring: "ring-amber-500/30",
      bar: "bg-amber-500",
      label: "Medium Risk",
    };
  }
  return {
    text: "text-emerald-500",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/30",
    bar: "bg-emerald-500",
    label: "Low Risk",
  };
}

/** Server + client shared scorers */

export function scoreIp(input: {
  is_vpn?: boolean;
  is_proxy?: boolean;
  is_tor?: boolean;
  is_hosting?: boolean;
  is_abuse?: boolean;
  is_relay?: boolean;
  abuseConfidence?: number | null;
  vtMalicious?: number;
  vtTotal?: number;
  otxPulses?: number;
  threatFoxHits?: number;
  censysServicesCount?: number;
  censysHasRiskyPorts?: boolean;
  censysRiskyPorts?: number[];
}): ThreatScore {
  const breakdown: ScoreBreakdownItem[] = [];
  if (input.is_tor) breakdown.push({ factor: "TOR exit node", points: 45 });
  if (input.is_abuse) breakdown.push({ factor: "Abuse / threat reputation", points: 35 });
  if (input.is_proxy) breakdown.push({ factor: "Proxy detected", points: 22 });
  if (input.is_vpn) breakdown.push({ factor: "VPN detected", points: 18 });
  if (input.is_relay) breakdown.push({ factor: "Privacy relay", points: 12 });
  if (input.is_hosting) breakdown.push({ factor: "Hosting / datacenter IP", points: 15 });
  if (typeof input.abuseConfidence === "number" && input.abuseConfidence > 0) {
    breakdown.push({
      factor: `AbuseIPDB confidence ${input.abuseConfidence}%`,
      points: Math.min(45, Math.round(input.abuseConfidence * 0.45)),
    });
  }
  if (typeof input.vtMalicious === "number" && input.vtMalicious > 0) {
    breakdown.push({
      factor: `VirusTotal ${input.vtMalicious}/${input.vtTotal ?? "?"} malicious`,
      points: Math.min(50, 20 + input.vtMalicious * 5),
    });
  }
  if (typeof input.otxPulses === "number" && input.otxPulses > 0) {
    breakdown.push({
      factor: `AlienVault OTX ${input.otxPulses} pulse(s)`,
      points: Math.min(35, 10 + input.otxPulses * 3),
    });
  }
  if (typeof input.threatFoxHits === "number" && input.threatFoxHits > 0) {
    breakdown.push({
      factor: `ThreatFox IOC match (${input.threatFoxHits})`,
      points: Math.min(40, 25 + input.threatFoxHits * 5),
    });
  }
  if (input.censysHasRiskyPorts) {
    const portsStr = input.censysRiskyPorts?.length ? input.censysRiskyPorts.join(", ") : "RDP/DB/SSH/FTP";
    breakdown.push({
      factor: `Censys exposed risky port(s) (${portsStr})`,
      points: Math.min(35, 18 + (input.censysRiskyPorts?.length || 1) * 5),
    });
  }
  if (typeof input.censysServicesCount === "number" && input.censysServicesCount > 10) {
    breakdown.push({
      factor: `Censys high service exposure (${input.censysServicesCount} ports open)`,
      points: 12,
    });
  }
  return buildThreat(breakdown, 8);
}

export function scorePhone(input: {
  valid?: boolean | null;
  is_voip?: boolean | null;
  risk_score?: number | null;
  line_type?: string | null;
}): ThreatScore {
  const breakdown: ScoreBreakdownItem[] = [];
  if (input.valid === false) breakdown.push({ factor: "Number failed validation", points: 40 });
  if (input.is_voip) breakdown.push({ factor: "VoIP / virtual line type", points: 20 });
  const lt = (input.line_type || "").toLowerCase();
  if (lt.includes("toll") || lt.includes("premium")) {
    breakdown.push({ factor: "Premium / toll line type", points: 25 });
  }
  if (typeof input.risk_score === "number" && input.risk_score > 0) {
    breakdown.push({
      factor: `Provider risk signal (${input.risk_score})`,
      points: Math.min(35, Math.round(input.risk_score * 0.35)),
    });
  }
  // Validation-friendly baseline — never claim "scammer"
  if (input.valid === true && breakdown.length === 0) {
    return buildThreat([{ factor: "Number structure validated", points: 0 }], 5);
  }
  return buildThreat(breakdown, input.valid === true ? 8 : 20);
}

export function scoreEmail(input: {
  disposable?: boolean | null;
  deliverability?: string | null;
  validation_status?: string | null;
  dns_ok?: boolean | null;
  free_provider?: boolean | null;
}): ThreatScore {
  const breakdown: ScoreBreakdownItem[] = [];
  if (input.disposable) breakdown.push({ factor: "Disposable email", points: 45 });
  if (input.validation_status === "invalid_format") {
    breakdown.push({ factor: "Invalid email format", points: 40 });
  }
  if (input.validation_status === "no_mx" || input.dns_ok === false) {
    breakdown.push({ factor: "Missing MX / DNS records", points: 30 });
  }
  const d = (input.deliverability || "").toLowerCase();
  if (d.includes("undeliver") || d === "mx_missing") {
    breakdown.push({ factor: "Poor deliverability", points: 25 });
  }
  if (input.free_provider) breakdown.push({ factor: "Free email provider", points: 8 });
  return buildThreat(breakdown, 6);
}

export function scoreFile(input: {
  findingsCount: number;
  findings?: string[];
  vtMalicious?: number;
  vtTotal?: number;
  hybridMalicious?: boolean;
  malwareBazaarFound?: boolean;
  threatFoxHits?: number;
}): ThreatScore {
  const breakdown: ScoreBreakdownItem[] = [];
  if (input.findingsCount > 0) {
    breakdown.push({
      factor: `${input.findingsCount} Scanii finding(s)`,
      points: Math.min(90, 50 + input.findingsCount * 15),
    });
    for (const f of (input.findings || []).slice(0, 3)) {
      breakdown.push({ factor: `Scanii: ${f}`, points: 5 });
    }
  }
  if (typeof input.vtMalicious === "number" && input.vtMalicious > 0) {
    breakdown.push({
      factor: `VirusTotal ${input.vtMalicious}/${input.vtTotal ?? "?"} malicious`,
      points: Math.min(55, 25 + input.vtMalicious * 6),
    });
  }
  if (input.hybridMalicious) {
    breakdown.push({ factor: "Hybrid Analysis malicious verdict", points: 45 });
  }
  if (input.malwareBazaarFound) {
    breakdown.push({ factor: "Listed on MalwareBazaar", points: 50 });
  }
  if (typeof input.threatFoxHits === "number" && input.threatFoxHits > 0) {
    breakdown.push({
      factor: `ThreatFox hash match (${input.threatFoxHits})`,
      points: Math.min(45, 30 + input.threatFoxHits * 5),
    });
  }
  return buildThreat(breakdown, 4);
}

export function scorePhish(input: {
  inPhishDb?: boolean;
  phishScore?: number | null;
  domainAgeDays?: number | null;
  urlscanMalicious?: boolean;
  manyRedirects?: boolean;
  safeBrowsingHit?: boolean;
  vtMalicious?: number;
  vtTotal?: number;
  urlhausListed?: boolean;
  otxPulses?: number;
  threatFoxHits?: number;
  censysHasRiskyPorts?: boolean;
  censysRiskyPorts?: number[];
  censysServicesCount?: number;
  dnsNoSpf?: boolean;
  dnsNoDmarc?: boolean;
  dnsSuspiciousNs?: boolean;
}): ThreatScore {
  const breakdown: ScoreBreakdownItem[] = [];
  if (input.inPhishDb) {
    breakdown.push({ factor: "Listed in phishing database", points: 55 });
  }
  if (typeof input.phishScore === "number" && input.phishScore > 0) {
    breakdown.push({
      factor: `PhishStats confidence (${input.phishScore})`,
      points: Math.min(30, Math.round(Number(input.phishScore) * 3)),
    });
  }
  if (typeof input.domainAgeDays === "number") {
    if (input.domainAgeDays < 30) {
      breakdown.push({ factor: "Domain recently registered (<30 days)", points: 28 });
    } else if (input.domainAgeDays < 90) {
      breakdown.push({ factor: "Young domain (<90 days)", points: 18 });
    } else if (input.domainAgeDays < 365) {
      breakdown.push({ factor: "Domain less than 1 year old", points: 8 });
    }
  }
  if (input.urlscanMalicious) {
    breakdown.push({ factor: "urlscan.io flagged malicious/phishing", points: 40 });
  }
  if (input.safeBrowsingHit) {
    breakdown.push({ factor: "Google Safe Browsing threat match", points: 50 });
  }
  if (typeof input.vtMalicious === "number" && input.vtMalicious > 0) {
    breakdown.push({
      factor: `VirusTotal URL ${input.vtMalicious}/${input.vtTotal ?? "?"} malicious`,
      points: Math.min(45, 20 + input.vtMalicious * 5),
    });
  }
  if (input.urlhausListed) {
    breakdown.push({ factor: "URLhaus malware distribution listing", points: 48 });
  }
  if (typeof input.otxPulses === "number" && input.otxPulses > 0) {
    breakdown.push({
      factor: `AlienVault OTX ${input.otxPulses} pulse(s)`,
      points: Math.min(30, 10 + input.otxPulses * 3),
    });
  }
  if (typeof input.threatFoxHits === "number" && input.threatFoxHits > 0) {
    breakdown.push({
      factor: `ThreatFox IOC match (${input.threatFoxHits})`,
      points: Math.min(35, 20 + input.threatFoxHits * 5),
    });
  }
  if (input.censysHasRiskyPorts) {
    const portsStr = input.censysRiskyPorts?.length ? input.censysRiskyPorts.join(", ") : "management/DB";
    breakdown.push({
      factor: `Censys: Host exposes risky management port(s) (${portsStr})`,
      points: Math.min(25, 15 + (input.censysRiskyPorts?.length || 1) * 4),
    });
  }
  if (input.manyRedirects) {
    breakdown.push({ factor: "Long redirect chain", points: 12 });
  }
  if (input.dnsNoSpf) {
    breakdown.push({ factor: "DNS: No SPF record (phishing-facilitating config)", points: 10 });
  }
  if (input.dnsNoDmarc) {
    breakdown.push({ factor: "DNS: No DMARC record (domain spoofing possible)", points: 12 });
  }
  if (input.dnsSuspiciousNs) {
    breakdown.push({ factor: "DNS: Suspicious / free-tier nameserver provider", points: 15 });
  }
  return buildThreat(breakdown, 10);
}
