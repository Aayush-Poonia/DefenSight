import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http";

export async function fetchDisify(email: string): Promise<Record<string, unknown>> {
  const key = requireEnv("DISIFY_API_KEY");
  const res = await safeFetch(`https://disify.com/api/email/${encodeURIComponent(email)}`, {
    headers: {
      "X-Api-Key": key,
      Authorization: `Bearer ${key}`,
    },
  });
  const data = (await parseJsonSafe(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (data?.error as string) || (data?.message as string) || `Disify HTTP ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }
  return data;
}
