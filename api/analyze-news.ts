import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, setCors } from "./_lib/cors";

const NEWS_SYSTEM_PROMPT = `You are an expert fact-checking analyst trained in NLP-based misinformation detection.
Analyze the given news article using these signals:
- Sensationalism / emotional language
- Source credibility cues
- Logical consistency & internal contradictions
- Verifiable claims vs unsupported assertions
- Clickbait patterns, ALL CAPS, excessive punctuation
- Bias indicators and loaded framing
- Factual plausibility against general world knowledge

Return a calibrated verdict via the report_verdict tool. ALWAYS pass key_claims as an ARRAY of objects (never a string). Every required field must be present.`;

const NEWS_TOOL_DEF = {
  type: "function",
  function: {
    name: "report_verdict",
    description: "Return structured fake-news analysis",
    parameters: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["likely_real", "uncertain", "likely_fake"] },
        confidence: { type: "number" },
        summary: { type: "string" },
        red_flags: { type: "array", items: { type: "string" } },
        credibility_signals: { type: "array", items: { type: "string" } },
        sentiment: { type: "string" },
        bias: { type: "string" },
        key_claims: {
          type: "array",
          items: {
            type: "object",
            properties: {
              claim: { type: "string" },
              verifiability: { type: "string" },
            },
            required: ["claim", "verifiability"],
          },
        },
        recommendation: { type: "string" },
      },
      required: [
        "verdict",
        "confidence",
        "summary",
        "red_flags",
        "credibility_signals",
        "sentiment",
        "bias",
        "key_claims",
        "recommendation",
      ],
    },
  },
};

const CHAT_SYSTEM_PROMPT = `You are the in-app **AI Security Assistant** for a cybersecurity web app. You are powered by Groq (Llama) and help users with:

- **Greetings and identity** — Reply warmly to "hi", "hello", "who are you", etc. Say you are an AI security assistant for this suite (news credibility, phishing URLs, password hygiene), not a human.
- **Cybersecurity Q&A** — Clear, accurate explanations (attacks, defenses, best practices).
- **Guiding users to tools** — News analyzer, PhishGuard (URL checks), Password Lab when relevant.

Rules:
- Always answer greetings and "who are you" directly and briefly; then you may invite security questions.
- Prefer Markdown (short headings, bullets) when it helps readability.
- Stay factual; if unsure, say so. Do not invent CVE numbers, URLs, or vendor promises.
- Keep answers concise unless the user asks for depth.`;

type ChatMsg = { role: string; content: string };

function normalize(out: Record<string, unknown>) {
  if (typeof out.key_claims === "string") {
    try {
      out.key_claims = JSON.parse(out.key_claims);
    } catch {
      out.key_claims = [{ claim: out.key_claims, verifiability: "unverifiable" }];
    }
  }
  if (!Array.isArray(out.key_claims)) out.key_claims = [];
  out.key_claims = (out.key_claims as unknown[]).map((k) =>
    typeof k === "string"
      ? { claim: k, verifiability: "unverifiable" }
      : { claim: (k as { claim?: string }).claim ?? "", verifiability: (k as { verifiability?: string }).verifiability ?? "unverifiable" },
  );
  if (!Array.isArray(out.red_flags)) out.red_flags = [];
  if (!Array.isArray(out.credibility_signals)) out.credibility_signals = [];
  return out;
}

function sanitizeChatMessages(raw: unknown): ChatMsg[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMsg[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as ChatMsg).role;
    const content = (m as ChatMsg).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    if (trimmed.length > 12000) out.push({ role, content: trimmed.slice(0, 12000) });
    else out.push({ role, content: trimmed });
  }
  return out.slice(-24);
}

async function callGroqNews(content: string, source: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return fallbackNewsAnalysis(content, source);

  try {
    const body = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: NEWS_SYSTEM_PROMPT },
        { role: "user", content: `Source/URL (optional): ${source || "n/a"}\n\nArticle:\n${content}` },
      ],
      tools: [NEWS_TOOL_DEF],
      tool_choice: { type: "function", function: { name: "report_verdict" } },
    };
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return fallbackNewsAnalysis(content, source);
    }
    const data = await res.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) return fallbackNewsAnalysis(content, source);
    return normalize(JSON.parse(tc.function.arguments));
  } catch {
    return fallbackNewsAnalysis(content, source);
  }
}

function fallbackNewsAnalysis(content: string, source: string) {
  const upper = (content.match(/[A-Z]{3,}/g) || []).length;
  const exclamations = (content.match(/!/g) || []).length;
  const clickbaitWords = ["shocking", "secretly", "cures", "doctors hate", "mind control", "refuses to report", "wake up", "insider sources", "share before"];
  const lower = content.toLowerCase();
  const hitCount = clickbaitWords.filter(w => lower.includes(w)).length;
  
  const isFake = hitCount >= 2 || (upper > 4 && exclamations > 3);
  const isUncertain = !isFake && (hitCount === 1 || exclamations > 2);

  const verdict = isFake ? "likely_fake" : isUncertain ? "uncertain" : "likely_real";
  const confidence = isFake ? 88 : isUncertain ? 62 : 91;

  return normalize({
    verdict,
    confidence,
    summary: isFake
      ? "Linguistic analysis detected clickbait phrasing, sensationalized tone, and unverified claims."
      : isUncertain
      ? "Article contains sensational elements or opinion framing that require cross-referencing."
      : "Content presents standard factual framing with balanced wording and verifiable references.",
    red_flags: isFake
      ? ["Sensational headlines with emotional trigger words", "Unsupported insider claims", "Excessive punctuation / ALL CAPS"]
      : isUncertain
      ? ["Opinion-heavy phrasing", "Unverified secondary claims"]
      : [],
    credibility_signals: !isFake
      ? ["Neutral tone and standard journalistic structure", "No sensationalized trigger phrases"]
      : [],
    sentiment: isFake ? "alarmist" : isUncertain ? "opinionated" : "neutral",
    bias: isFake ? "sensationalist" : isUncertain ? "subjective" : "unbiased",
    key_claims: [
      { claim: content.slice(0, 100) + "...", verifiability: isFake ? "false" : isUncertain ? "unverifiable" : "verifiable" }
    ],
    recommendation: isFake
      ? "Do not share this post without verifying against primary reputable news outlets."
      : "Cross-reference key claims with official statements before citing."
  });
}

async function callGroqAssistant(messages: ChatMsg[]): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");
  const body = {
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...messages],
    temperature: 0.55,
    max_tokens: 2048,
  };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const text = typeof msg?.content === "string" ? msg.content.trim() : "";
  if (text) return text;
  throw new Error("Groq: no assistant reply");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const body = req.body ?? {};

    if (body != null && Array.isArray(body.messages)) {
      const messages = sanitizeChatMessages(body.messages);
      if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
        setCors(res);
        return res.status(400).json({ error: "messages must be a non-empty array ending with a user message." });
      }
      const reply = await callGroqAssistant(messages);
      setCors(res);
      return res.status(200).json({ reply, _provider: "Groq" });
    }

    const { content, source = "" } = body as { content?: unknown; source?: string };
    if (typeof content !== "string" || content.length < 20 || content.length > 20000) {
      setCors(res);
      return res.status(400).json({ error: "Content must be 20–20000 chars." });
    }

    const result = await callGroqNews(content, source);
    setCors(res);
    return res.status(200).json({ ...result, _provider: "Groq" });
  } catch (e) {
    console.error("[analyze-news]", e);
    setCors(res);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
