import type { VercelRequest, VercelResponse } from "@vercel/node";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function setCors(res: VercelResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

/** Returns true when the request is fully handled (OPTIONS / wrong method). */
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return true;
  }
  return false;
}

export function sendError(res: VercelResponse, e: unknown) {
  setCors(res);
  const status =
    e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number"
      ? (e as { status: number }).status
      : 500;
  const message = e instanceof Error ? e.message : "Unknown error";
  return res.status(status).json({ error: message });
}
