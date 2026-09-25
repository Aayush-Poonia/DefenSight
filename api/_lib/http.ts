/** Shared HTTP helpers for serverless API routes. */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type ProviderResult<T> = {
  ok: true;
  data: T;
  provider: string;
} | {
  ok: false;
  error: string;
  provider: string;
  status?: number;
};

export async function safeFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError("Upstream API timed out", 504);
    }
    throw new ApiError(e instanceof Error ? e.message : "Upstream request failed", 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new ApiError(`Server missing ${name}`, 500);
  return v;
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export async function settleProvider<T>(
  provider: string,
  fn: () => Promise<T>,
): Promise<ProviderResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, provider };
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 502;
    let rawMsg = e instanceof Error ? e.message : "Unknown provider error";
    if (rawMsg.includes("API key") || rawMsg.includes("Server missing") || rawMsg.includes("401") || rawMsg.includes("403")) {
      rawMsg = "Provider unconfigured (using local intelligence)";
    }
    return {
      ok: false,
      error: rawMsg,
      provider,
      status,
    };
  }
}
