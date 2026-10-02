import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCors, setCors } from "./_lib/cors.js";
import { settleProvider } from "./_lib/http.js";
import { fetchNewsApi, buildNewsSearchQuery, type NewsApiData } from "./_lib/providers/newsapi.js";

const NEWS_SYSTEM_PROMPT = `You are an expert fact-checking analyst trained in NLP-based misinformation detection.
Analyze the given news article using these signals:
- Sensationalism / emotional language
- Source credibility cues
- Logical consistency & internal contradictions
- Verifiable claims vs unsupported assertions
- Clickbait patterns, ALL CAPS, excessive punctuation
- Bias indicators and loaded framing
- Real-time global news coverage verification (NewsAPI telemetry)

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

const CHAT_SYSTEM_PROMPT = `You are DefenSight AI, a helpful, intelligent AI Assistant, Cyber Threat Investigator, and Real-Time News Analyst powered by Groq (Llama-3.3 70B) & NewsAPI.

Guidelines:
1. **Conversational AI Mode (ChatGPT / Gemini style)**:
   - Reply naturally, warmly, and intelligently to any general message, greeting, question, or news request.
   - Format your responses with clean Markdown (headings, bullet points, code blocks).

2. **Real-Time News Analysis (NewsAPI)**:
   - When provided with background news telemetry or NewsAPI article matches for a topic:
     - Present the latest breaking news stories from top global publishers (e.g., BBC, Reuters, The Verge, TechCrunch, Bloomberg, etc.).
     - Analyze each news article individually in your own intelligent words: explain the core story, key takeaways, security/tech implications, and why it matters.
     - Always provide structured markdown sections per article with publisher source attribution and clickable markdown links to the original articles (e.g. [Read Full Story on Reuters](url)).

3. **Security Tool Scanning & Detail Investigations**:
   - When provided with background threat scan telemetry (URL phishing data, VirusTotal malware scans, Scanii findings, email phishing audits, IP reputation, phone validation), analyze all telemetry thoroughly.
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
    // Cap each message at 3000 chars to avoid 413 payload-too-large
    if (trimmed.length > 3000) out.push({ role, content: trimmed.slice(0, 3000) });
    else out.push({ role, content: trimmed });
  }
  // Keep only last 6 turns to keep payload within Groq limits
  return out.slice(-6);
}

const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

async function callGroqNews(content: string, source: string, newsapiData?: NewsApiData | null) {
  const key = process.env.GROQ_API_KEY;

  let newsContextStr = "";
  if (newsapiData && newsapiData.articles.length > 0) {
    const pubList = newsapiData.top_publishers.join(", ") || "various sources";
    const topHeadlines = newsapiData.articles
      .slice(0, 3)
      .map((a) => `- "${a.title}" (${a.source.name})`)
      .join("\n");
    newsContextStr = `\n\nREAL-TIME NEWSAPI COVERAGE FOUND:\nTotal matching articles in global index: ${newsapiData.total_results}\nTop reporting publishers: ${pubList}\nMatching Headlines:\n${topHeadlines}`;
  } else {
    newsContextStr = `\n\nREAL-TIME NEWSAPI COVERAGE: No mainstream news outlets have reported on this exact topic/headline.`;
  }

  if (!key) return fallbackNewsAnalysis(content, source, newsapiData);

  for (const model of GROQ_MODELS) {
    try {
      const body = {
        model,
        messages: [
          { role: "system", content: NEWS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Source/URL (optional): ${source || "n/a"}${newsContextStr}\n\nArticle To Analyze:\n${content}`,
          },
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
  return fallbackNewsAnalysis(content, source, newsapiData);
}

function fallbackNewsAnalysis(content: string, source: string, newsapiData?: NewsApiData | null) {
  const upper = (content.match(/[A-Z]{3,}/g) || []).length;
  const exclamations = (content.match(/!/g) || []).length;
  const clickbaitWords = ["shocking", "secretly", "cures", "doctors hate", "mind control", "refuses to report", "wake up", "insider sources", "share before"];
  const lower = content.toLowerCase();
  const hitCount = clickbaitWords.filter(w => lower.includes(w)).length;
  
  const hasNewsApiCoverage = Boolean(newsapiData && newsapiData.total_results > 0);

  const isFake = !hasNewsApiCoverage && (hitCount >= 2 || (upper > 4 && exclamations > 3));
  const isUncertain = !isFake && !hasNewsApiCoverage && (hitCount === 1 || exclamations > 2);

  const verdict = isFake ? "likely_fake" : isUncertain ? "uncertain" : "likely_real";
  const confidence = hasNewsApiCoverage ? 94 : isFake ? 88 : isUncertain ? 62 : 85;

  const credSignals = !isFake
    ? ["Neutral tone and standard journalistic structure", "No sensationalized trigger phrases"]
    : [];
  if (hasNewsApiCoverage && newsapiData) {
    credSignals.push(`Verified against NewsAPI global index (${newsapiData.total_results} article(s) found across ${newsapiData.top_publishers.slice(0, 3).join(", ")})`);
  }

  return normalize({
    verdict,
    confidence,
    summary: hasNewsApiCoverage
      ? `Cross-referenced with live global news coverage via NewsAPI. Found ${newsapiData?.total_results} matching article(s) from publishers including ${newsapiData?.top_publishers.slice(0, 3).join(", ")}.`
      : isFake
      ? "Linguistic analysis detected clickbait phrasing, sensationalized tone, and unverified claims."
      : isUncertain
      ? "Article contains sensational elements or opinion framing that require cross-referencing."
      : "Content presents standard factual framing with balanced wording and verifiable references.",
    red_flags: isFake
      ? ["Sensational headlines with emotional trigger words", "Unsupported insider claims", "Excessive punctuation / ALL CAPS"]
      : isUncertain
      ? ["Opinion-heavy phrasing", "Unverified secondary claims"]
      : [],
    credibility_signals: credSignals,
    sentiment: isFake ? "alarmist" : isUncertain ? "opinionated" : "neutral",
    bias: isFake ? "sensationalist" : isUncertain ? "subjective" : "unbiased",
    key_claims: [
      { claim: content.slice(0, 100) + "...", verifiability: hasNewsApiCoverage ? "verifiable" : isFake ? "false" : isUncertain ? "unverifiable" : "verifiable" }
    ],
    recommendation: isFake
      ? "Do not share this post without verifying against primary reputable news outlets."
      : "Cross-reference key claims with official statements before citing."
  });
}

function fallbackAssistantReply(userMsg: string): string {
  const q = userMsg.trim().toLowerCase();

  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo)\b/i.test(q)) {
    return `Hello! 👋 I am **DefenSight AI**, your dedicated AI Security Assistant & Threat Investigator.\n\nI can help you with:\n- **Cybersecurity Q&A** — Ask me about SQL injection, XSS, password hygiene, BEC, 2FA/MFA, VPNs, or code auditing.\n- **Background Threat Scanning** — Ask me to scan a URL, check an email message, audit an attached file, or lookup IP threat scores.\n- **Live News Analysis** — Ask me for the latest news on any topic and I'll fetch and analyze it for you.\n\nHow can I assist you today?`;
  }

  // Identity questions — broad match including casual phrasings
  if (
    /^(who are you|what are you|what is your name|identify yourself)\b/i.test(q) ||
    /tell me (about|more about) (your)?s?e?l?f/i.test(q) ||
    /about (your)?s?e?l?f/i.test(q) ||
    /what('?s| is) defensight/i.test(q)
  ) {
    return `## About DefenSight AI 🤖🛡️\n\nI am **DefenSight AI** — an advanced Cyber Threat Intelligence Assistant & Real-Time News Analyst.\n\n**Powered by:**\n- 🔥 **Groq (Llama-3.3 70B)** — Ultra-fast LLM inference\n- 📰 **NewsAPI** — Real-time global news cross-referencing\n- 🔍 **VirusTotal, URLScan, PhishStats, OTX, ThreatFox, Censys, MaxMind** — Multi-source threat intelligence\n- 🌐 **DNSDumpster** — DNS reconnaissance & phishing detection\n\n**What I can do:**\n1. **Cybersecurity Q&A** — Answer any security question conversationally\n2. **URL & Domain Scans** — PhishGuard with 10+ threat intelligence feeds\n3. **File & Malware Analysis** — VirusTotal + Scanii scanning\n4. **Email Phishing Audits** — BEC & wire fraud detection\n5. **IP & Phone Intelligence** — Geo-location, ASN, reputation scoring\n6. **Live News Analysis** — Fetch and AI-analyze breaking news on any topic\n\nAsk me anything — I'm here to help! 🚀`;
  }

  if (/^(how are you|how's it going|what's up)\b/i.test(q)) {
    return `I'm operating at full capacity and ready to assist! 🟢\n\nYou can ask me about cybersecurity topics, request a threat scan, or ask for the latest news on any topic. What would you like to explore today?`;
  }

  if (/^(what can you do|help|features|capabilities|commands)\b/i.test(q)) {
    return `## DefenSight AI Capabilities 🛡️\n\n- **Conversational Security Q&A**: Ask about web security, vulnerability fixes, cryptography, or security architecture.\n- **URL Phishing Scans**: Ask to *"scan https://example.com"* to check domain reputation and phishing indicators.\n- **Email Phishing Audits**: Paste an email or email header to check for BEC and wire fraud.\n- **File Scanning**: Attach any file or paste code/logs to scan across VirusTotal, Scanii, and ThreatFox.\n- **IP & Phone Intelligence**: Lookup IP addresses or phone numbers for risk ratings.\n- **Live News**: Ask *"tell me the latest blockchain news"* or *"give me AI news"* for real-time articles.`;
  }

  // News requests — provide guidance when Groq can't be reached
  if (/\b(news|headline|headlines|latest|breaking)\b/i.test(q)) {
    const topic = q.replace(/\b(tell me|give me|show me|what('?s| is)|the|latest|breaking|news|headline|headlines|about|on|for)\b/gi, "").trim() || "cybersecurity";
    return `## 📰 Live News Request\n\nI'm currently experiencing high load and couldn't connect to the AI model, but your request for **"${topic}" news** has been noted.\n\n**To get the latest news**, try:\n- Rephrasing as: *"fetch blockchain news"* or *"latest AI cybersecurity news"*\n- Visiting our **News Analyzer** page for full article credibility analysis\n\nOr just retry your message — I'll pull real-time articles from global publishers (BBC, Reuters, TechCrunch, Bloomberg, etc.) and analyze them for you!`;
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

  return `## DefenSight AI\n\nI received your message but couldn't connect to the AI model right now.\n\n💡 **Try asking me:**\n- "Tell me about yourself"\n- "Scan https://example.com"\n- "Latest cybersecurity news"\n- "What is XSS?"\n- "How do I prevent phishing?"\n\nFeel free to retry — I'm usually back online within seconds!`;
}

async function callGroqAssistant(messages: ChatMsg[]): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  const rawLastUserMsg = messages.filter((m) => m.role === "user").pop()?.content || "";
  // Strip appended telemetry block so fallback patterns can match the original query
  const lastUserMsg = rawLastUserMsg.split("\n\n[BACKGROUND THREAT TELEMETRY")[0].trim();

  if (!key) {
    return fallbackAssistantReply(lastUserMsg);
  }

  for (const model of GROQ_MODELS) {
    try {
      const body = {
        model,
        messages: [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...messages],
        temperature: 0.55,
        max_tokens: 1500,
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

    const searchQuery = buildNewsSearchQuery(content, source);
    const newsapiRes = await settleProvider("newsapi", () => fetchNewsApi(searchQuery, 5));
    const newsapiData = newsapiRes.ok ? newsapiRes.data : null;

    const result = await callGroqNews(content, source, newsapiData);
    setCors(res);
    return res.status(200).json({
      ...result,
      newsapi: newsapiData
        ? {
            total_results: newsapiData.total_results,
            top_publishers: newsapiData.top_publishers,
            articles: newsapiData.articles.map((a) => ({
              title: a.title,
              source: a.source.name,
              author: a.author,
              url: a.url,
              urlToImage: a.urlToImage,
              publishedAt: a.publishedAt,
              description: a.description,
            })),
          }
        : null,
      _provider: "Groq + NewsAPI",
    });
  } catch (e) {
    console.error("[analyze-news]", e);
    setCors(res);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}

