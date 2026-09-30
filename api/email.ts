import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors.js";
import { settleProvider } from "./_lib/http.js";
import { fetchAbstractEmail } from "./_lib/providers/abstract.js";
import { fetchDisify } from "./_lib/providers/disify.js";
import { scoreEmail } from "./_lib/threat-score.js";
import { validateEmail } from "./_lib/validators.js";

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const email = validateEmail(req.body?.email);
    const [abstract, disify] = await Promise.all([
      settleProvider("abstract_email", () => fetchAbstractEmail(email)),
      settleProvider("disify", () => fetchDisify(email)),
    ]);

    const ab = (abstract.ok && abstract.data) ? abstract.data : {};
    const di = (disify.ok && disify.data) ? disify.data : {};
    const emailQuality = asObj(ab.email_quality ?? ab.quality);
    const emailDeliverability = asObj(ab.email_deliverability ?? ab.deliverability);
    const emailRisk = asObj(ab.email_risk ?? ab.risk);
    const emailDomain = asObj(ab.email_domain ?? ab.domain_detail ?? ab.domain);

    const disposable =
      bool(di.disposable) ??
      bool(emailQuality.is_disposable) ??
      bool(ab.is_disposable_email) ??
      bool(ab.disposable) ??
      null;

    const reputation =
      str(emailQuality.score) ||
      str(emailRisk.address_risk_status) ||
      str(ab.reputation) ||
      (typeof di.confidence === "number" ? `confidence:${di.confidence}` : null);

    const deliverability =
      str(emailDeliverability.status) ||
      str(
        emailDeliverability.is_format_valid != null
          ? emailDeliverability.is_smtp_valid === true
            ? "deliverable"
            : emailDeliverability.is_mx_valid === false
              ? "undeliverable"
              : "unknown"
          : null,
      ) ||
      (bool(di.dns) === true ? "mx_ok" : bool(di.dns) === false ? "mx_missing" : null);

    const domain =
      str(di.domain) ||
      str(emailDomain.domain) ||
      str(typeof ab.domain === "string" ? ab.domain : null) ||
      email.split("@")[1] ||
      null;

    const mx =
      (Array.isArray(emailDomain.mx_records) ? emailDomain.mx_records : null) ||
      (Array.isArray(ab.mx_records) ? ab.mx_records : null) ||
      (bool(di.dns) != null ? [{ has_mx: di.dns }] : null);

    const validationStatus =
      bool(di.format) === false
        ? "invalid_format"
        : disposable
          ? "disposable"
          : bool(di.dns) === false
            ? "no_mx"
            : "validated";

    const freeProvider = bool(di.free) ?? bool(emailQuality.is_free_email);
    const threat = scoreEmail({
      disposable,
      deliverability,
      validation_status: validationStatus,
      dns_ok: bool(di.dns),
      free_provider: freeProvider,
    });

    const result = {
      email,
      disposable,
      reputation,
      deliverability,
      domain,
      provider: domain,
      mx_records: mx,
      risk_level: threat.risk_level,
      validation_status: validationStatus,
      threat_score: threat.score,
      threat,
      extras: {
        free_provider: freeProvider,
        role_based: bool(di.role) ?? bool(emailQuality.is_role),
        format_ok: bool(di.format),
        dns_ok: bool(di.dns),
      },
      sources: {
        abstract: abstract.ok ? { ok: true } : { error: abstract.error },
        disify: disify.ok ? { ok: true } : { error: disify.error },
      },
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/email]", e);
    return sendError(res, e);
  }
}

