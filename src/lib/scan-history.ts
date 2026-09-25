export type ScanType =
  | "ip"
  | "phone"
  | "email"
  | "email_ai"
  | "phishing"
  | "file"
  | "news"
  | "password";

export type LocalScan = {
  id: string;
  type: ScanType;
  input: string;
  result: Record<string, unknown>;
  threat_score?: number;
  risk_level?: string;
  ts: number;
};

const KEY = "cybersuite.scan-history.v1";

function readAll(): LocalScan[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: LocalScan[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
}

export function getScans(): LocalScan[] {
  return readAll().sort((a, b) => b.ts - a.ts);
}

export function addScan(partial: Omit<LocalScan, "id" | "ts"> & { id?: string; ts?: number }): LocalScan {
  const item: LocalScan = {
    id: partial.id || crypto.randomUUID(),
    type: partial.type,
    input: partial.input,
    result: partial.result,
    threat_score: partial.threat_score,
    risk_level: partial.risk_level,
    ts: partial.ts || Date.now(),
  };
  const next = [item, ...readAll().filter((s) => !(s.type === item.type && s.input === item.input))];
  writeAll(next);
  return item;
}

export function deleteScan(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function clearScans() {
  writeAll([]);
}

export function mostUsedModule(scans = getScans()): ScanType | null {
  if (!scans.length) return null;
  const counts = new Map<ScanType, number>();
  for (const s of scans) counts.set(s.type, (counts.get(s.type) || 0) + 1);
  let best: ScanType | null = null;
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

export function detectQueryType(raw: string): { type: ScanType | "domain"; value: string; path: string } | null {
  const q = raw.trim();
  if (!q) return null;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) {
    return { type: "email", value: q, path: `/intel/email?q=${encodeURIComponent(q)}` };
  }

  if (/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/.test(q)) {
    return { type: "ip", value: q, path: `/intel/ip?q=${encodeURIComponent(q)}` };
  }

  if (q.includes(":") && /^[0-9a-fA-F:]+$/.test(q) && q.length >= 3) {
    return { type: "ip", value: q, path: `/intel/ip?q=${encodeURIComponent(q)}` };
  }

  const phone = q.replace(/[\s()-]/g, "");
  if (/^\+?\d{10,15}$/.test(phone)) {
    return { type: "phone", value: phone, path: `/intel/phone?q=${encodeURIComponent(phone)}` };
  }

  if (/^https?:\/\//i.test(q) || (q.includes(".") && (q.includes("/") || q.includes("?")))) {
    const url = /^https?:\/\//i.test(q) ? q : `https://${q}`;
    return { type: "phishing", value: url, path: `/phishing?q=${encodeURIComponent(url)}` };
  }

  if (/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(q)) {
    const url = `https://${q}`;
    return { type: "domain", value: q, path: `/phishing?q=${encodeURIComponent(url)}` };
  }

  return null;
}

export function modulePath(type: ScanType): string {
  switch (type) {
    case "ip":
      return "/intel/ip";
    case "phone":
      return "/intel/phone";
    case "file":
      return "/intel/file";
    case "email":
      return "/intel/email";
    case "email_ai":
      return "/email";
    case "phishing":
      return "/phishing";
    case "news":
      return "/news";
    case "password":
      return "/password";
    default:
      return "/dashboard";
  }
}
