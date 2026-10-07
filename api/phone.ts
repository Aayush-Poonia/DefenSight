import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors.js";
import { settleProvider } from "./_lib/http.js";
import { fetchAbstractPhone } from "./_lib/providers/abstract.js";
import { fetchNumverify } from "./_lib/providers/numverify.js";
import { fetchVeriphone } from "./_lib/providers/veriphone.js";
import { scorePhone } from "./_lib/threat-score.js";
import { validatePhone } from "./_lib/validators.js";

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

    // Run all three providers in parallel
    const [numverify, abstract, veriphone] = await Promise.all([
      settleProvider("numverify", () => fetchNumverify(phone)),
      settleProvider("abstract_phone", () => fetchAbstractPhone(phone, countryHint)),
      settleProvider("veriphone", () => fetchVeriphone(phone)),
    ]);

    const nv = numverify.ok ? numverify.data : {};
    const ab = abstract.ok ? abstract.data : {};
    const vp = veriphone.ok ? veriphone.data : null;

    const phoneLoc = asObj(ab.phone_location);
    const phoneCarrier = asObj(ab.phone_carrier);
    const phoneFmt = asObj(ab.phone_format);
    const phoneVal = asObj(ab.phone_validation);
    const phoneRisk = asObj(ab.phone_risk);
    const abCountry = asObj(ab.country);
    const abFormat = asObj(ab.format);

    // --- Merge validity across all three sources ---
    const valid = pickValid(nv.valid, phoneVal.is_valid, ab.valid, vp?.phone_valid);

    // --- Country (priority: Veriphone → Numverify → Abstract) ---
    const country =
      str(vp?.country) ||
      str(nv.country_name) ||
      str(phoneLoc.country_name) ||
      str(abCountry.name) ||
      str(vp?.country_code) ||
      str(nv.country_code) ||
      null;

    // --- Carrier (Veriphone has the best carrier data) ---
    const carrier =
      str(vp?.carrier) ||
      str(nv.carrier) ||
      str(phoneCarrier.name) ||
      str(ab.carrier) ||
      null;

    // --- Line type (Veriphone phone_type is very reliable) ---
    const lineType =
      str(vp?.phone_type) ||
      str(nv.line_type) ||
      str(phoneCarrier.line_type) ||
      str(ab.type) ||
      str(ab.line_type) ||
      null;

    // --- Formatted numbers ---
    const international =
      str(vp?.international_number) ||
      str(nv.international_format) ||
      str(phoneFmt.international) ||
      str(abFormat.international) ||
      str(ab.phone) ||
      null;

    const local =
      str(vp?.local_number) ||
      str(nv.local_format) ||
      str(phoneFmt.national) ||
      str(abFormat.local) ||
      str(ab.local_format) ||
      null;

    // --- Region (Veriphone phone_region = human-readable "City, State") ---
    const region =
      str(vp?.phone_region) ||
      str(nv.location) ||
      [phoneLoc.city, phoneLoc.region].filter(Boolean).join(", ") ||
      str(ab.location) ||
      str(ab.region) ||
      null;

    // --- Timezone (Veriphone returns array; pick first) ---
    const timezone =
      (vp?.timezone && vp.timezone.length > 0 ? vp.timezone[0] : null) ||
      str(phoneLoc.timezone) ||
      null;

    // --- VoIP detection (any source that says VoIP wins) ---
    const isVoip =
      typeof phoneVal.is_voip === "boolean"
        ? phoneVal.is_voip
        : typeof ab.is_voip === "boolean"
          ? ab.is_voip
          : phoneCarrier.line_type === "voip"
            ? true
            : vp?.phone_type === "voip"
              ? true
              : vp?.geographical === false
                ? true
                : null;

    const providerRisk =
      typeof ab.risk_score === "number" ? ab.risk_score : riskToScore(str(phoneRisk.risk_level));

    // --- Score with all three sources combined ---
    const threat = scorePhone({
      valid,
      is_voip: isVoip,
      risk_score: providerRisk,
      line_type: lineType,
      veriphone_valid: vp?.phone_valid ?? null,
      is_non_geographical: vp ? vp.geographical === false : null,
      veriphone_type: vp?.phone_type ?? null,
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
      timezone,
      validation_score,
      threat_score: threat.score,
      risk_level: threat.risk_level,
      threat,
      number_info: {
        country_code: str(vp?.country_code) || str(nv.country_code) || str(phoneLoc.country_code) || str(abCountry.code) || null,
        country_prefix: str(vp?.country_prefix) || str(nv.country_prefix) || str(phoneLoc.country_prefix) || str(abCountry.prefix) || null,
        e164: str(vp?.e164) || null,
        is_voip: isVoip,
        is_geographical: vp?.geographical ?? null,
        line_status: str(phoneVal.line_status),
        timezone,
        note: "Validation & carrier enrichment via Veriphone, Numverify & AbstractAPI.",
      },
      sources: {
        numverify: numverify.ok ? { ok: true } : { error: numverify.error },
        abstract: abstract.ok ? { ok: true } : { error: abstract.error },
        veriphone: veriphone.ok
          ? {
              ok: true,
              phone_valid: vp?.phone_valid,
              phone_type: vp?.phone_type,
              geographical: vp?.geographical,
              region: vp?.phone_region,
              country: vp?.country,
              carrier: vp?.carrier,
              e164: vp?.e164,
              timezone: vp?.timezone,
            }
          : { error: veriphone.error },
      },
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/phone]", e);
    return sendError(res, e);
  }
}
