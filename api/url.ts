import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors";
import { settleProvider } from "./_lib/http";
import { fetchPhishStats } from "./_lib/providers/phishstats";
import { searchUrlscan } from "./_lib/providers/urlscan";
import { validateUrl } from "./_lib/validators";

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const url = validateUrl(req.body?.url);
    const [phish, urlscan] = await Promise.all([
      settleProvider("phishstats", () => fetchPhishStats(url)),
      settleProvider("urlscan", () => searchUrlscan(url)),
    ]);

    if (!phish.ok && !urlscan.ok) {
      setCors(res);
      return res.status(502).json({
        error: "All URL providers failed",
        sources: { phishstats: phish, urlscan },
      });
    }

    const matches = phish.ok ? phish.data.matches : [];
    const top = matches[0] || null;
    const urlscanHits = urlscan.ok
      ? Array.isArray((urlscan.data as { results?: unknown[] }).results)
        ? ((urlscan.data as { results: Record<string, unknown>[] }).results)
        : []
      : [];

    const confidence =
      top && top.score != null
        ? Number(top.score)
        : phish.ok && phish.data.found
          ? 70
          : urlscanHits.length > 0
            ? 40
            : 0;

    const result = {
      url,
      in_phishing_records: phish.ok ? phish.data.found : false,
      threat_information: top
        ? {
            title: str(top.title),
            target: str(top.target),
            country: str(top.countrycode) || str(top.country),
            ip: str(top.ip),
            score: top.score ?? null,
            tld: str(top.tld),
          }
        : phish.ok
          ? { note: "No matching phishing records found in PhishStats" }
          : { error: phish.error },
      detection_time: top ? str(top.date) || str(top.datetime) : null,
      confidence,
      source: phish.ok && phish.data.found ? "PhishStats" : urlscanHits.length ? "urlscan.io (historical)" : "none",
      urlscan: {
        total: urlscan.ok ? (urlscan.data as { total?: number }).total ?? urlscanHits.length : 0,
        results: urlscanHits.slice(0, 3).map((r) => ({
          task_url: str(asNested(r, "task", "url")),
          page_url: str(asNested(r, "page", "url")),
          verdicts: asNested(r, "verdicts") ?? null,
          result: str(asNested(r, "result")),
          time: str(asNested(r, "task", "time")),
        })),
        error: urlscan.ok ? null : urlscan.error,
      },
      matches: matches.slice(0, 5),
    };

    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/url]", e);
    return sendError(res, e);
  }
}

function asNested(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
