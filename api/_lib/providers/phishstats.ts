import { ApiError, parseJsonSafe, requireEnv, safeFetch } from "../http.js";

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

export async function fetchPhishStats(url: string): Promise<{
  found: boolean;
  matches: Record<string, unknown>[];
  query: string;
}> {
  const key = requireEnv("PHISHSTATS_API_KEY");
  const host = extractHost(url);
  const pathHint = (() => {
    try {
      const u = new URL(url);
      return `${u.hostname}${u.pathname}`.slice(0, 120);
    } catch {
      return host;
    }
  })();

  // Prefer URL-like match, then domain fallback
  const where = `(url,like,${pathHint})`;
  const endpoint =
    `https://api.phishstats.info/api/phishing` +
    `?_where=${encodeURIComponent(where)}` +
    `&_sort=-date&_size=10&_p=1`;

  let res = await safeFetch(endpoint, {
    headers: {
      "X-API-Key": key,
      Authorization: `Bearer ${key}`,
    },
  });
  let data = await parseJsonSafe(res);

  if (!res.ok && res.status !== 404) {
    // Retry with domain-only filter
    const whereDomain = `(url,like,${host})`;
    res = await safeFetch(
      `https://api.phishstats.info/api/phishing?_where=${encodeURIComponent(whereDomain)}&_sort=-date&_size=10&_p=1`,
      {
        headers: {
          "X-API-Key": key,
          Authorization: `Bearer ${key}`,
        },
      },
    );
    data = await parseJsonSafe(res);
  }

  if (res.status === 429) {
    const err = data as { error?: string; message?: string };
    throw new ApiError(err?.error || err?.message || "PhishStats rate limit exceeded", 429);
  }

  if (!res.ok && res.status !== 404) {
    const err = data as { error?: string; message?: string };
    throw new ApiError(err?.error || err?.message || `PhishStats HTTP ${res.status}`, 502);
  }

  const matches = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  // Tighten: prefer rows whose url contains host
  const filtered = matches.filter((m) => {
    const u = String(m.url || "").toLowerCase();
    return u.includes(host);
  });

  return {
    found: filtered.length > 0,
    matches: filtered.slice(0, 5),
    query: pathHint,
  };
}

