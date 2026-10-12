import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, sendError, setCors } from "./_lib/cors.js";
import { ApiError } from "./_lib/http.js";
import {
  HACKERTARGET_TOOLS,
  runHackerTargetTool,
  type HackerTargetTool,
} from "./_lib/providers/hackertarget.js";

const ALIASES: Record<string, HackerTargetTool> = {
  dns: "dnslookup",
  dnslookup: "dnslookup",
  "dns lookup": "dnslookup",
  hostsearch: "hostsearch",
  "host search": "hostsearch",
  subdomain: "hostsearch",
  subdomains: "hostsearch",
  whois: "whois",
  reversedns: "reversedns",
  "reverse dns": "reversedns",
  ptr: "reversedns",
  reverseiplookup: "reverseiplookup",
  "reverse ip": "reverseiplookup",
  geoip: "geoip",
  geolocation: "geoip",
  aslookup: "aslookup",
  asn: "aslookup",
  httpheaders: "httpheaders",
  headers: "httpheaders",
  pagelinks: "pagelinks",
  "page links": "pagelinks",
  bannerlookup: "bannerlookup",
  banner: "bannerlookup",
  ping: "ping",
  mtr: "mtr",
  traceroute: "mtr",
  subnetcalc: "subnetcalc",
  subnet: "subnetcalc",
  cidr: "subnetcalc",
  zonetransfer: "zonetransfer",
  axfr: "zonetransfer",
  analyticslookup: "analyticslookup",
  "reverse analytics": "analyticslookup",
  findshareddns: "findshareddns",
  "shared dns": "findshareddns",
  nmap: "nmap",
  "port scan": "nmap",
  "tcp scan": "nmap",
  nmap_udp: "nmap_udp",
  "udp scan": "nmap_udp",
};

function resolveTool(raw: unknown): HackerTargetTool {
  const key = String(raw || "").trim().toLowerCase();
  const mapped = ALIASES[key] || (key in HACKERTARGET_TOOLS ? (key as HackerTargetTool) : null);
  if (!mapped) {
    throw new ApiError(
      `Unknown HackerTarget tool. Use one of: ${Object.keys(HACKERTARGET_TOOLS).join(", ")}`,
      400,
    );
  }
  return mapped;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  try {
    const tool = resolveTool(req.body?.tool);
    const target = String(req.body?.target ?? req.body?.q ?? "").trim();
    if (!target || target.length > 400) throw new ApiError("target is required", 400);
    const result = await runHackerTargetTool(tool, target);
    setCors(res);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[api/hackertarget]", e);
    return sendError(res, e);
  }
}
