import { createHash } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors.js";
import { settleProvider } from "./_lib/http.js";
import { lookupMalwareBazaarHash, searchThreatFox } from "./_lib/providers/abusech.js";
import { searchHybridAnalysisHash } from "./_lib/providers/hybridanalysis.js";
import { scanWithScanii } from "./_lib/providers/scanii.js";
import { fetchVirusTotalFile, vtStats } from "./_lib/providers/virustotal.js";
import { scoreFile } from "./_lib/threat-score.js";
import { validateFilePayload } from "./_lib/validators.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const { filename, buffer, contentType } = validateFilePayload(req.body ?? {});
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    const [scanii, vt, hybrid, mb, tfox] = await Promise.all([
      settleProvider("scanii", () => scanWithScanii(buffer, filename, contentType)),
      settleProvider("virustotal", () => fetchVirusTotalFile(sha256)),
      settleProvider("hybrid_analysis", () => searchHybridAnalysisHash(sha256)),
      settleProvider("malwarebazaar", () => lookupMalwareBazaarHash(sha256)),
      settleProvider("threatfox", () => searchThreatFox(sha256)),
    ]);

    const raw = (scanii.ok && scanii.data) ? scanii.data : {};
    const findings = Array.isArray(raw.findings) ? raw.findings : [];
    const findingLabels = findings.map((f) => (typeof f === "string" ? f : JSON.stringify(f)));

    const vtRaw = (vt.ok && vt.data) ? vt.data : {};
    const vtHasData =
      vt.ok && (vtRaw as { found?: boolean }).found !== false && Boolean((vtRaw as { data?: unknown }).data);
    const vtS = vtHasData
      ? vtStats(vtRaw as Record<string, unknown>)
      : { malicious: 0, suspicious: 0, total: 0, harmless: 0 };

    const hybridArr = hybrid.ok && Array.isArray(hybrid.data) ? hybrid.data : [];
    const hybridMalicious = hybridArr.some((item) => {
      const o = asObj(item);
      const threat = String(o.threat_level || o.verdict || "").toLowerCase();
      return threat.includes("malicious") || threat.includes("suspicious");
    });

    const mbRaw = (mb.ok && mb.data) ? mb.data : {};
    const mbData = Array.isArray((mbRaw as { data?: unknown[] }).data)
      ? (mbRaw as { data: unknown[] }).data
      : [];
    const malwareBazaarFound =
      (mbRaw as { query_status?: string }).query_status === "ok" && mbData.length > 0;

    const tfoxRaw = (tfox.ok && tfox.data) ? tfox.data : {};
    const tfoxData = Array.isArray(tfoxRaw.data) ? tfoxRaw.data : [];
    const threatFoxHits = tfoxData.length;

    const externalHits =
      findings.length +
      vtS.malicious +
      (hybridMalicious ? 1 : 0) +
      (malwareBazaarFound ? 1 : 0) +
      threatFoxHits;

    const threat = scoreFile({
      findingsCount: findings.length,
      findings: findingLabels,
      vtMalicious: vtS.malicious,
      vtTotal: vtS.total,
      hybridMalicious,
      malwareBazaarFound,
      threatFoxHits,
    });

    const suspicious = externalHits > 0 || threat.score >= 31;
    const detection_results = [
      ...findingLabels.map((f) => ({ source: "scanii", label: f })),
      ...(vtS.malicious > 0
        ? [{ source: "virustotal", label: `${vtS.malicious}/${vtS.total} engines flagged malicious` }]
        : []),
      ...(hybridMalicious ? [{ source: "hybrid_analysis", label: "Malicious/suspicious sandbox verdict" }] : []),
      ...(malwareBazaarFound ? [{ source: "malwarebazaar", label: "Hash found on MalwareBazaar" }] : []),
      ...tfoxData.slice(0, 5).map((item) => ({
        source: "threatfox",
        label: str(asObj(item).malware) || str(asObj(item).ioc) || "ThreatFox IOC match",
      })),
    ];

    const result = {
      scan_status: "completed",
      verdict: suspicious ? "suspicious" : "safe",
      safe: !suspicious,
      detection_results,
      threat_score: threat.score,
      risk_level: threat.risk_level,
      threat,
      file_information: {
        filename,
        content_type: str(raw.content_type) || contentType,
        content_length: typeof raw.content_length === "number" ? raw.content_length : buffer.length,
        checksum: str(raw.checksum) || sha256,
        sha256,
        id: str(raw.id),
        creation_date: str(raw.creation_date),
      },
      intel: {
        virustotal: { malicious: vtS.malicious, total: vtS.total, found: vtHasData },
        hybrid_analysis: { matches: hybridArr.length, malicious: hybridMalicious },
        malwarebazaar: { found: malwareBazaarFound },
        threatfox: { hits: threatFoxHits },
      },
      sources: {
        scanii: scanii.ok ? { ok: true } : { error: scanii.error },
        virustotal: vt.ok ? { ok: true } : { error: vt.error },
        hybrid_analysis: hybrid.ok ? { ok: true } : { error: hybrid.error },
        malwarebazaar: mb.ok ? { ok: true } : { error: mb.error },
        threatfox: tfox.ok ? { ok: true } : { error: tfox.error },
      },
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/file]", e);
    return sendError(res, e);
  }
}

