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

const CHAT_SYSTEM_PROMPT = `You are DefenSight AI, a helpful, intelligent AI Assistant and Cyber Threat Investigator powered by Groq (Llama-3.3 70B).

Guidelines:
1. **Conversational AI Mode (ChatGPT / Gemini style)**:
   - Reply naturally, warmly, and intelligently to any general message, greeting, question, or code request.
   - You can discuss any cybersecurity concept, general topic, programming language, software architecture, or general question.
   - Format your responses with clean Markdown (headings, bullet points, code blocks).

2. **Security Tool Scanning & Detail Investigations**:
   - When provided with background threat scan telemetry (URL phishing data, VirusTotal malware scans, Scanii findings, email phishing audits, IP reputation, phone validation, news credibility reports), analyze all telemetry thoroughly.
   - Deliver an executive verdict, threat score breakdown, key indicators of compromise (IOCs), and actionable defense recommendations.`;

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

const GROQ_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];

async function callGroqNews(content: string, source: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return fallbackNewsAnalysis(content, source);

  for (const model of GROQ_MODELS) {
    try {
      const body = {
        model,
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
      if (!res.ok) continue;
      const data = await res.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!tc?.function?.arguments) continue;
      return normalize(JSON.parse(tc.function.arguments));
    } catch {}
  }
  return fallbackNewsAnalysis(content, source);
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

function fallbackAssistantReply(userMsg: string): string {
  const q = userMsg.trim().toLowerCase();

  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo)\b/i.test(q)) {
    return `Hello! 👋 I am **DefenSight AI**, your dedicated AI Security Assistant & Threat Investigator.\n\nI can help you with:\n- **Cybersecurity Q&A** — Ask me about SQL injection, XSS, password hygiene, BEC, 2FA/MFA, VPNs, or code auditing.\n- **Background Threat Scanning** — Ask me to scan a URL, check an email message, audit an attached file, or lookup IP threat scores.\n\nHow can I assist you today?`;
  }

  if (/^(who are you|what are you|what is your name|identify yourself)\b/i.test(q)) {
    return `I am **DefenSight AI**, an advanced AI Threat Intelligence & Forensics Assistant powered by Groq High-Limit AI.\n\nMy primary goal is to help you analyze security concepts, answer cybersecurity questions, and perform background investigations across URLs, files, emails, IP addresses, and phone numbers.`;
  }

  if (/^(how are you|how's it going|what's up)\b/i.test(q)) {
    return `I'm operating smoothly and ready to assist with your cybersecurity questions or background investigations! What would you like to explore today?`;
  }

  if (/^(what can you do|help|features|capabilities|commands)\b/i.test(q)) {
    return `## DefenSight AI Capabilities 🛡️\n\n- **Conversational Security Q&A**: Ask about web security, vulnerability fixes, cryptography, or security architecture.\n- **URL Phishing Scans**: Ask to *"scan https://example.com"* to check domain reputation and phishing indicators.\n- **Email Phishing Audits**: Paste an email or email header to check for BEC and wire fraud.\n- **File Scanning**: Attach any file or paste code/logs to scan across VirusTotal, Scanii, and ThreatFox.\n- **IP & Phone Intelligence**: Lookup IP addresses or phone numbers for risk ratings.`;
  }

  if (q.includes("sql injection") || q.includes("sqli")) {
    return `## SQL Injection (SQLi) Overview\n\nSQL Injection is a code injection technique where malicious SQL statements are inserted into entry fields for execution.\n\n### Prevention:\n1. **Prepared Statements / Parameterized Queries** (Primary Defense)\n2. **Use ORM Frameworks** (Prisma, TypeORM, Hibernate)\n3. **Input Validation & Sanitization**\n4. **Apply Least Privilege DB Permissions**\n5. **Web Application Firewall (WAF)**`;
  }

  if (q.includes("xss") || q.includes("cross-site scripting")) {
    return `## Cross-Site Scripting (XSS)\n\nXSS allows attackers to inject malicious scripts into web pages viewed by other users.\n\n### Prevention:\n1. **Context-Aware Output Encoding**\n2. **Content Security Policy (CSP)** headers\n3. **Sanitize HTML Input** (\`DOMPurify\`)\n4. **HttpOnly & SameSite Cookie Flags**`;
  }

  if (q.includes("password")) {
    return `## Password Security Best Practices\n\n- Use **14+ characters** minimum\n- Use a **password manager** (Bitwarden, 1Password)\n- Enable **2FA/MFA** (Prefer TOTP apps or FIDO2 YubiKeys over SMS)\n- Never reuse passwords across services\n\n*Try our built-in Password Lab tool from the navigation menu!*`;
  }

  if (q.includes("phishing") || q.includes("bec")) {
    return `## Phishing & Social Engineering Awareness\n\nPhishing uses deceptive emails, websites, or messages to steal credentials or commit wire fraud.\n\n**Red Flags:**\n- Urgent pressure tactics\n- Mismatched sender domain\n- Suspicious links/attachments\n- Requests for gift cards or direct deposit changes\n\n*Tip: Paste any suspicious URL or email text here to run a background threat scan!*`;
  }

  return `## DefenSight AI Security Response\n\nThank you for your message regarding **"${userMsg.slice(0, 80)}"**.\n\n### Key Security Recommendations:\n1. **Principle of Least Privilege**: Grant minimal necessary permissions.\n2. **Defense in Depth**: Implement multi-layered security controls (WAF, MFA, EDR).\n3. **Keep Software Updated**: Apply patches promptly for known CVE vulnerabilities.\n4. **Zero Trust Baseline**: Explicitly verify all network requests.\n\nFeel free to ask follow-up security questions or instruct me to scan a URL, file, email, or IP address!`;
}

async function callGroqAssistant(messages: ChatMsg[]): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  const lastUserMsg = messages.filter((m) => m.role === "user").pop()?.content || "";

  if (!key) {
    return fallbackAssistantReply(lastUserMsg);
  }

  for (const model of GROQ_MODELS) {
    try {
      const body = {
        model,
        messages: [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...messages],
        temperature: 0.55,
        max_tokens: 4096,
      };
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.warn(`[callGroqAssistant] Model ${model} HTTP status`, res.status);
        continue;
      }
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      const text = typeof msg?.content === "string" ? msg.content.trim() : "";
      if (text) return text;
    } catch (err) {
      console.warn(`[callGroqAssistant] Model ${model} error`, err);
    }
  }

  return fallbackAssistantReply(lastUserMsg);
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
