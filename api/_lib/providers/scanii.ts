import { ApiError, optionalEnv, parseJsonSafe, requireEnv, safeFetch } from "../http";

function scaniiCredentials(): { key: string; secret: string } {
  const rawKey = requireEnv("SCANII_API_KEY");
  const rawSecret = optionalEnv("SCANII_API_SECRET") || "";

  // Support KEY:SECRET packed into SCANII_API_KEY
  if (rawKey.includes(":") && !rawSecret) {
    const [key, ...rest] = rawKey.split(":");
    return { key, secret: rest.join(":") };
  }
  return { key: rawKey, secret: rawSecret };
}

function scaniiAuthHeader(): string {
  const { key, secret } = scaniiCredentials();
  if (!secret) {
    throw new ApiError(
      "Scanii requires SCANII_API_KEY and SCANII_API_SECRET (from your Scanii dashboard).",
      500,
    );
  }
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

export async function scanWithScanii(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<Record<string, unknown>> {
  const bases = [
    optionalEnv("SCANII_API_BASE"),
    "https://api-us1.scanii.com/v2.2",
    "https://api.scanii.com/v2.2",
  ].filter(Boolean) as string[];

  const uniqueBases = [...new Set(bases)];
  let lastError = "Scanii request failed";

  for (const base of uniqueBases) {
    try {
      // Prefer native FormData (Node 18+ / undici)
      const form = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], {
        type: contentType || "application/octet-stream",
      });
      form.append("file", blob, filename);

      const res = await safeFetch(
        `${base}/files`,
        {
          method: "POST",
          headers: { Authorization: scaniiAuthHeader() },
          body: form,
        },
        45000,
      );

      const data = (await parseJsonSafe(res)) as Record<string, unknown>;
      if (res.ok || res.status === 201) return data;

      lastError =
        (data?.message as string) ||
        (data?.error as string) ||
        `Scanii HTTP ${res.status}`;

      if (res.status === 401 || res.status === 403) {
        throw new ApiError(
          "Scanii authentication failed — check SCANII_API_KEY and SCANII_API_SECRET.",
          502,
        );
      }
      // try next region on 404/5xx
      if (res.status < 500 && res.status !== 404) {
        throw new ApiError(lastError, res.status === 429 ? 429 : 502);
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 502 || e.status === 500 || e.message.includes("authentication"))) {
        throw e;
      }
      lastError = e instanceof Error ? e.message : lastError;
    }
  }

  throw new ApiError(lastError, 502);
}
