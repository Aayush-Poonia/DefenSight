import { ApiError, optionalEnv, parseJsonSafe, safeFetch } from "../http.js";

export interface VeriphoneData {
  status: string;
  phone: string;
  phone_valid: boolean;
  phone_type: string | null;        // "mobile" | "fixed_line" | "voip" | "unknown" etc.
  phone_region: string | null;
  country: string | null;
  country_code: string | null;
  country_prefix: string | null;
  international_number: string | null;
  local_number: string | null;
  e164: string | null;
  carrier: string | null;
  timezone: string[] | null;
  geographical: boolean | null;     // true = geographic number, false = non-geographic (VoIP/virtual)
}

/**
 * Veriphone v2 — phone validation & carrier enrichment.
 * Endpoint: GET https://api.veriphone.io/v2/verify?phone={e164}&key={key}
 */
export async function fetchVeriphone(phone: string): Promise<VeriphoneData> {
  const key =
    optionalEnv("VERIPHONE_API_KEY") || "C1CD8149D66B4C9E83EB4115C3E915B4";

  const url =
    `https://api.veriphone.io/v2/verify?phone=${encodeURIComponent(phone)}&key=${encodeURIComponent(key)}`;

  const res = await safeFetch(url);
  const data = (await parseJsonSafe(res)) as Record<string, unknown>;

  if (!res.ok || !data || data.status === "error") {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : `Veriphone HTTP ${res.status}`;
    throw new ApiError(String(msg), res.status === 429 ? 429 : 502);
  }

  return {
    status: String(data.status ?? "success"),
    phone: String(data.phone ?? phone),
    phone_valid: Boolean(data.phone_valid),
    phone_type: typeof data.phone_type === "string" ? data.phone_type : null,
    phone_region: typeof data.phone_region === "string" ? data.phone_region : null,
    country: typeof data.country === "string" ? data.country : null,
    country_code: typeof data.country_code === "string" ? data.country_code : null,
    country_prefix: typeof data.country_prefix === "string" ? data.country_prefix : null,
    international_number: typeof data.international_number === "string" ? data.international_number : null,
    local_number: typeof data.local_number === "string" ? data.local_number : null,
    e164: typeof data.e164 === "string" ? data.e164 : null,
    carrier: typeof data.carrier === "string" && data.carrier !== "unknown" ? data.carrier : null,
    timezone: Array.isArray(data.timezone) ? (data.timezone as string[]) : null,
    geographical: typeof data.geographical === "boolean" ? data.geographical : null,
  };
}
