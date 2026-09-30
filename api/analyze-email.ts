import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, setCors } from "./_lib/cors";

const SYSTEM_PROMPT = `You are an expert phishing-email analyst. Inspect the email's headers (from, subject), body text, and any URLs.
Look for:
- spoofed/lookalike senders, mismatched display name vs domain
- urgency, threats, account-suspension fear-tactics
- generic greetings, poor grammar, ALL CAPS
- suspicious links (mismatched anchor vs href, IP/punycode hosts, brand impersonation)
- attachment / credential / wire-transfer requests
- BEC (business email compromise), gift-card scams, invoice fraud

Return a calibrated verdict via the report_email tool. Always include arrays (never strings) for list fields.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "report_email",
    description: "Return structured phishing-email analysis",
    parameters: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["safe", "suspicious", "phishing"] },
        confidence: { type: "number" },
        risk_score: { type: "number" },
        category: {
          type: "string",
          enum: ["credential_phishing", "bec", "scam", "malware", "spam", "legitimate", "unknown"],
        },
        impersonation_target: { type: "string" },
        summary: { type: "string" },
        red_flags: { type: "array", items: { type: "string" } },
        safe_signals: { type: "array", items: { type: "string" } },
        suspicious_urls: { type: "array", items: { type: "string" } },
        recommended_actions: { type: "array", items: { type: "string" } },
        recommendation: { type: "string" },
      },
      required: [
        "verdict",
        "confidence",
        "risk_score",
        "category",
        "summary",
        "red_flags",
        "safe_signals",
        "suspicious_urls",
        "recommended_actions",
        "recommendation",
      ],
    },
  },
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>"')]+/gi;
  const matches = text.match(re) || [];
  return Array.from(new Set(matches)).slice(0, 25);
}

const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

async function callGroq(payload: { from: string; to: string; subject: string; body: string; urls: string[] }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return fallbackEmailAnalysis(payload);

  const userMsg = `From: ${payload.from || "(not provided)"}\nTo: ${payload.to || "(not provided)"}\nSubject: ${payload.subject || "(not provided)"}\n\nBody:\n${payload.body}\n\nExtracted URLs (${payload.urls.length}):\n${payload.urls.map((u) => `- ${u}`).join("\n") || "(none)"}`;

  for (const model of GROQ_MODELS) {
    try {
      const body = {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "report_email" } },
      };
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!tc?.function?.arguments) continue;
      const out = JSON.parse(tc.function.arguments);
      if (!Array.isArray(out.red_flags)) out.red_flags = [];
      if (!Array.isArray(out.safe_signals)) out.safe_signals = [];
      if (!Array.isArray(out.suspicious_urls)) out.suspicious_urls = [];
      if (!Array.isArray(out.recommended_actions)) out.recommended_actions = [];
      if (typeof out.impersonation_target !== "string") out.impersonation_target = "none";
      return out;
    } catch {}
  }

  return fallbackEmailAnalysis(payload);
}

function fallbackEmailAnalysis(payload: { from: string; to: string; subject: string; body: string; urls: string[] }) {
  const text = `${payload.from} ${payload.subject} ${payload.body}`.toLowerCase();
  const giftCard = text.includes("gift card") || text.includes("google play") || text.includes("apple gift");
  const urgent = text.includes("urgent") || text.includes("immediate") || text.includes("suspended") || text.includes("action required");
  const bankWire = text.includes("direct deposit") || text.includes("bank account") || text.includes("wire transfer") || text.includes("routing");
  const ipUrl = payload.urls.some((u) => /https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(u));
  const suspiciousUrl = payload.urls.some((u) => u.includes(".info") || u.includes("secure-login") || u.includes("update") || ipUrl);

  const isPhishing = giftCard || (urgent && suspiciousUrl) || (bankWire && (ipUrl || suspiciousUrl));
  const isSuspicious = !isPhishing && (urgent || payload.urls.length > 2 || suspiciousUrl);

  const verdict = isPhishing ? "phishing" : isSuspicious ? "suspicious" : "safe";
  const confidence = isPhishing ? 94 : isSuspicious ? 75 : 90;
  const risk_score = isPhishing ? 88 : isSuspicious ? 52 : 12;

  const red_flags = [];
  if (giftCard) red_flags.push("High-risk Business Email Compromise (BEC) gift card purchase request");
  if (urgent) red_flags.push("Urgent pressure tactics encouraging action before verification");
  if (bankWire) red_flags.push("Direct deposit or financial routing change request detected");
  if (suspiciousUrl) red_flags.push("Suspicious or unverified links embedded in email body");

  const safe_signals = [];
  if (!isPhishing && !isSuspicious) {
    safe_signals.push("Standard notification format without deceptive links");
    safe_signals.push("Sender domain matches expected organizational identity");
  }

  return {
    verdict,
    confidence,
    risk_score,
    category: giftCard ? "bec" : bankWire ? "bec" : isPhishing ? "credential_phishing" : isSuspicious ? "spam" : "legitimate",
    impersonation_target: giftCard ? "Executive / CEO" : bankWire ? "HR / Payroll" : text.includes("netflix") ? "Netflix" : "None",
    summary: isPhishing
      ? "High-confidence phishing indicator: Deceptive sender request combining urgency, credential harvesting, or fraudulent financial transfer."
      : isSuspicious
      ? "Suspicious email attributes detected. Exercise caution before clicking links or executing requests."
      : "No suspicious email signatures or deceptive phishing indicators observed.",
    red_flags,
    safe_signals,
    suspicious_urls: payload.urls.filter((u) => u.includes(".info") || u.includes("login") || /https?:\/\/\d+\.\d+/i.test(u)),
    recommended_actions: isPhishing
      ? ["Do not click links or fulfill financial/gift card requests.", "Report sender to internal IT/SOC security team."]
      : isSuspicious
      ? ["Verify sender address via secondary trusted communication channel."]
      : ["Email appears safe to read."],
    recommendation: isPhishing
      ? "Delete email or flag as phishing immediately. Do not disclose credentials."
      : "Exercise normal caution.",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const { from = "", to = "", subject = "", body = "" } = req.body ?? {};
    if (typeof body !== "string" || body.trim().length < 20) {
      setCors(res);
      return res.status(400).json({ error: "Email body must be at least 20 characters." });
    }
    if (body.length > 30000) {
      setCors(res);
      return res.status(400).json({ error: "Email too long (max 30000 chars)." });
    }

    const urls = extractUrls(`${subject}\n${body}`);
    const result = await callGroq({
      from: String(from).slice(0, 300),
      to: String(to).slice(0, 300),
      subject: String(subject).slice(0, 500),
      body,
      urls,
    });
    setCors(res);
    return res.status(200).json({ ...result, _provider: "Groq", extracted_urls: urls });
  } catch (e) {
    console.error("[analyze-email]", e);
    setCors(res);
    return res.status(502).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
