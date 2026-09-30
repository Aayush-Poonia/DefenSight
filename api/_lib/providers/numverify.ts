import { ApiError, optionalEnv, parseJsonSafe, requireEnv, safeFetch } from "../http.js";

/** Numverify / APILayer Number Verification */
export async function fetchNumverify(phone: string): Promise<Record<string, unknown>> {
  const key = requireEnv("NUMVERIFY_API_KEY");
  const rapidKey = optionalEnv("RAPIDAPI_KEY");

  // Prefer classic numverify access_key endpoint; fall back to APILayer header style.
  const classicUrl =
    `https://apilayer.net/api/validate?access_key=${encodeURIComponent(key)}` +
    `&number=${encodeURIComponent(phone)}`;

  let res = await safeFetch(classicUrl);
  let data = (await parseJsonSafe(res)) as Record<string, unknown> & {
    success?: boolean;
    error?: { info?: string; type?: string };
  };

  if (res.ok && data && !data.error && (data.valid === true || data.valid === false || data.number)) {
    return data;
  }

  // APILayer marketplace style
  res = await safeFetch(
    `https://api.apilayer.com/number_verification/validate?number=${encodeURIComponent(phone)}`,
    { headers: { apikey: key } },
  );
  data = (await parseJsonSafe(res)) as typeof data;
  if (res.ok && data && !data.error) return data;

  // Optional RapidAPI bridge if configured
  if (rapidKey) {
    const host = optionalEnv("RAPIDAPI_NUMVERIFY_HOST") || "numverify.p.rapidapi.com";
    res = await safeFetch(
      `https://${host}/validate?number=${encodeURIComponent(phone)}`,
      {
        headers: {
          "X-RapidAPI-Key": rapidKey,
          "X-RapidAPI-Host": host,
        },
      },
    );
    data = (await parseJsonSafe(res)) as typeof data;
    if (res.ok && data && !data.error) return data;
  }

  const msg =
    (typeof data?.error === "object" && data.error?.info) ||
    (typeof data?.error === "string" ? data.error : null) ||
    `Numverify HTTP ${res.status}`;
  throw new ApiError(String(msg), res.status === 429 ? 429 : 502);
}

