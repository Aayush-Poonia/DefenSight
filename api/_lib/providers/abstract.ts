import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http.js";

export async function fetchAbstractIp(ip: string): Promise<Record<string, unknown>> {
  const key = requireEnv("ABSTRACT_IP_API_KEY");
  const url =
    `https://ip-intelligence.abstractapi.com/v1/?api_key=${encodeURIComponent(key)}` +
    `&ip_address=${encodeURIComponent(ip)}`;
  const res = await safeFetch(url);
  const data = (await parseJsonSafe(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (data?.error as string) || `Abstract IP HTTP ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }
  return data;
}

export async function fetchAbstractPhone(phone: string, country?: string): Promise<Record<string, unknown>> {
  const key = requireEnv("ABSTRACT_PHONE_API_KEY");
  let url =
    `https://phoneintelligence.abstractapi.com/v1/?api_key=${encodeURIComponent(key)}` +
    `&phone=${encodeURIComponent(phone)}`;
  if (country) url += `&country=${encodeURIComponent(country)}`;
  const res = await safeFetch(url);
  const data = (await parseJsonSafe(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (data?.error as string) || `Abstract Phone HTTP ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }
  return data;
}

export async function fetchAbstractEmail(email: string): Promise<Record<string, unknown>> {
  const key = requireEnv("ABSTRACT_EMAIL_API_KEY");
  const url =
    `https://emailreputation.abstractapi.com/v1/?api_key=${encodeURIComponent(key)}` +
    `&email=${encodeURIComponent(email)}`;
  const res = await safeFetch(url);
  const data = (await parseJsonSafe(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (data?.error as string) || `Abstract Email HTTP ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }
  return data;
}

