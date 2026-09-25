import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors";
import { fetchWhoisFreaks } from "./_lib/providers/whoisfreaks";
import { validateDomain } from "./_lib/validators";

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function calcAgeDays(created: string | null): number | null {
  if (!created) return null;
  const ms = Date.now() - new Date(created).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86400000));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const domain = validateDomain(req.body?.domain);
    const raw = await fetchWhoisFreaks(domain);
    const createDate =
      str(raw.create_date) ||
      str(raw.created_date) ||
      str(asObj(raw.domain_registered).create_date) ||
      str(asObj(raw.registry_data).create_date) ||
      null;
    const expiryDate =
      str(raw.expiry_date) ||
      str(raw.expire_date) ||
      str(asObj(raw.domain_registered).expiry_date) ||
      str(asObj(raw.registry_data).expiry_date) ||
      null;
    const registrarObj = asObj(raw.domain_registrar);
    const registrar =
      str(registrarObj.name) ||
      str(registrarObj.registrar_name) ||
      str(raw.registrar_name) ||
      str(raw.registrar) ||
      null;

    let nameServers: string[] = [];
    const ns = raw.name_servers ?? raw.nameservers ?? asObj(raw.registry_data).name_servers;
    if (Array.isArray(ns)) {
      nameServers = ns.map((n) => (typeof n === "string" ? n : str(asObj(n).name_server) || "")).filter(Boolean);
    } else if (ns && typeof ns === "object") {
      const arr = (ns as { hostNames?: string[] }).hostNames;
      if (Array.isArray(arr)) nameServers = arr;
    }

    const ageDays = calcAgeDays(createDate);
    const ageLabel =
      ageDays == null
        ? null
        : ageDays < 30
          ? `${ageDays} days (very new)`
          : ageDays < 365
            ? `${ageDays} days`
            : `${(ageDays / 365).toFixed(1)} years`;

    const result = {
      domain: str(raw.domain_name) || domain,
      registrar,
      registration_date: createDate,
      expiration_date: expiryDate,
      domain_age: ageLabel,
      domain_age_days: ageDays,
      name_servers: nameServers,
      whois: {
        status: raw.domain_status ?? raw.status ?? null,
        updated_date: str(raw.update_date) || str(raw.updated_date),
        whois_server: str(raw.whois_server),
        registrant: raw.registrant_contact ?? raw.registrant ?? null,
        raw,
      },
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/domain]", e);
    return sendError(res, e);
  }
}
