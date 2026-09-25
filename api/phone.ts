import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors";
import { settleProvider } from "./_lib/http";
import { fetchAbstractPhone } from "./_lib/providers/abstract";
import { fetchNumverify } from "./_lib/providers/numverify";
import { scorePhone } from "./_lib/threat-score";
import { validatePhone } from "./_lib/validators";

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function pickValid(...vals: unknown[]): boolean | null {
  for (const v of vals) {
    if (typeof v === "boolean") return v;
  }
  return null;
}

function riskToScore(level: string | null): number | null {
  if (!level) return null;
  const l = level.toLowerCase();
  if (l === "high") return 75;
  if (l === "medium") return 45;
  if (l === "low") return 15;
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const phone = validatePhone(req.body?.phone ?? req.body?.number);
    const countryHint = typeof req.body?.country === "string" ? req.body.country.trim() : undefined;

    const [numverify, abstract] = await Promise.all([
      settleProvider("numverify", () => fetchNumverify(phone)),
      settleProvider("abstract_phone", () => fetchAbstractPhone(phone, countryHint)),
    ]);

    const nv = numverify.ok ? numverify.data : {};
    const ab = abstract.ok ? abstract.data : {};

    const phoneLoc = asObj(ab.phone_location);
    const phoneCarrier = asObj(ab.phone_carrier);
    const phoneFmt = asObj(ab.phone_format);
    const phoneVal = asObj(ab.phone_validation);
    const phoneRisk = asObj(ab.phone_risk);
    const abCountry = asObj(ab.country);
    const abFormat = asObj(ab.format);

    const valid = pickValid(nv.valid, phoneVal.is_valid, ab.valid);
    const country =
      str(nv.country_name) ||
      str(phoneLoc.country_name) ||
      str(abCountry.name) ||
      str(nv.country_code) ||
      str(phoneLoc.country_code) ||
      null;
    const carrier = str(nv.carrier) || str(phoneCarrier.name) || str(ab.carrier) || null;
    const lineType =
      str(nv.line_type) || str(phoneCarrier.line_type) || str(ab.type) || str(ab.line_type) || null;
    const international =
      str(nv.international_format) ||
      str(phoneFmt.international) ||
      str(abFormat.international) ||
      str(ab.phone) ||
      str(ab.phone_number) ||
      null;
    const local =
      str(nv.local_format) ||
      str(phoneFmt.national) ||
      str(abFormat.local) ||
      str(ab.local_format) ||
      null;
    const region =
      str(nv.location) ||
      [phoneLoc.city, phoneLoc.region].filter(Boolean).join(", ") ||
      str(ab.location) ||
      str(ab.region) ||
      null;
    const isVoip =
      typeof phoneVal.is_voip === "boolean"
        ? phoneVal.is_voip
        : typeof ab.is_voip === "boolean"
          ? ab.is_voip
          : phoneCarrier.line_type === "voip"
            ? true
            : null;
    const providerRisk =
      typeof ab.risk_score === "number" ? ab.risk_score : riskToScore(str(phoneRisk.risk_level));

    const threat = scorePhone({
      valid,
      is_voip: isVoip,
      risk_score: providerRisk,
      line_type: lineType,
    });

    const validation_score =
      valid === false
        ? Math.max(0, 100 - threat.score)
        : valid === true
          ? Math.max(40, 100 - threat.score)
          : Math.max(20, 70 - Math.round(threat.score / 2));

    const result = {
      phone,
      valid,
      country,
      carrier,
      line_type: lineType,
      international_format: international,
      local_format: local,
      region,
      validation_score,
      threat_score: threat.score,
      risk_level: threat.risk_level,
      threat,
      number_info: {
        country_code: str(nv.country_code) || str(phoneLoc.country_code) || str(abCountry.code) || null,
        country_prefix: str(nv.country_prefix) || str(phoneLoc.country_prefix) || str(abCountry.prefix) || null,
        is_voip: isVoip,
        line_status: str(phoneVal.line_status),
        timezone: str(phoneLoc.timezone),
        note: "Validation & carrier enrichment only — APIs do not provide scam reputation.",
      },
      sources: {
        numverify: numverify.ok ? { ok: true } : { error: numverify.error },
        abstract: abstract.ok ? { ok: true } : { error: abstract.error },
      },
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/phone]", e);
    return sendError(res, e);
  }
}
