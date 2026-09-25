import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { analyzeNewsArticle, analyzeNewsAssistantChat } from "@/lib/api";
import { intelApi } from "@/lib/intel-api";
import { saveChatMessage, getChatHistory, clearChatHistory } from "@/lib/firestore";
import { Loader2, Send, Trash2, Bot, User, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PageHeader } from "@/components/layout/PageHeader";

type Message = { role: "user" | "assistant"; content: string };

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    getChatHistory(user.uid)
      .then((docs) => {
        setMessages(docs.map((d) => ({ role: d.role as "user" | "assistant", content: d.content as string })));
      })
      .catch(() => {
        toast.error("Could not load chat history from Firestore.");
      });
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Determine if user wants a tool action
      const lower = userMsg.toLowerCase();
      let assistantContent = "";

      if (lower.includes("analyze news") || lower.includes("check article") || lower.includes("fake news")) {
        const textToAnalyze = userMsg.replace(/analyze news|check article|fake news/gi, "").trim();
        if (textToAnalyze.length > 20) {
          try {
            const result: any = await analyzeNewsArticle({ content: textToAnalyze, source: "" });
            assistantContent = `## News Analysis Result\n\n**Verdict:** ${result.verdict} (${result.confidence}% confidence)\n\n**Summary:** ${result.summary}\n\n**Sentiment:** ${result.sentiment} | **Bias:** ${result.bias}\n\n${result.red_flags?.length ? `**Red Flags:**\n${result.red_flags.map((f: string) => `- ${f}`).join("\n")}` : ""}\n\n**Recommendation:** ${result.recommendation}`;
          } catch {
            assistantContent = "I tried to analyze that text but the analysis service returned an error. Please try again or use the News Analyzer tool directly.";
          }
        } else {
          assistantContent = "Please provide the article text you'd like me to analyze. Paste the full content after your request.";
        }
      } else if (userMsg.match(/https?:\/\/[^\s]+/)) {
        const urlMatch = userMsg.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          try {
            const result = await intelApi.phishingIntel(urlMatch[0]);
            assistantContent = `## URL Investigation\n\n**URL:** ${urlMatch[0]}\n**Status:** ${result.phishing_status}\n**Threat Score:** ${result.threat_score}/100 (${result.risk_level} risk)\n\n**Domain:** ${result.domain}\n**Domain Age:** ${result.domain_age || "Unknown"}\n\n${result.recommendations?.[0] || ""}`;
          } catch {
            assistantContent = "I couldn't analyze that URL. Please try the PhishGuard tool directly.";
          }
        }
      } else if (/\b(check url|is this safe|is this (site|link|url) safe|phishguard|scan (this )?url)\b/i.test(lower)) {
        assistantContent =
          "Paste a full **https://…** link in the same message and I’ll run **PhishGuard** on it. You can also open the Phishing page from the menu.";
      } else {
        try {
          const historyForApi = newMessages.map((m) => ({ role: m.role, content: m.content }));
          const raw = await analyzeNewsAssistantChat({ messages: historyForApi });
          const reply = typeof raw?.reply === "string" ? raw.reply.trim() : "";
          assistantContent = reply || getCyberResponse(userMsg);
        } catch (e: unknown) {
          console.error("[chat]", e);
          assistantContent = getCyberResponse(userMsg);
        }
      }

      const trimmed = (assistantContent || "").trim();
      assistantContent = trimmed || getCyberResponse(userMsg);

      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);

      try {
        await saveChatMessage(user.uid, "user", userMsg);
        await saveChatMessage(user.uid, "assistant", assistantContent);
      } catch {
        toast.warning("Reply could not be saved to the cloud; it still appears in this session.");
      }
    } catch (err: any) {
      toast.error("Failed to process message");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!user) return;
    await clearChatHistory(user.uid);
    setMessages([]);
    toast.success("Chat history cleared");
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 h-[calc(100vh-7rem)]">
      <Toaster richColors position="top-center" />

      <PageHeader
        badge="Groq AI Engine"
        title="Chat with"
        highlight="DefenSight AI"
        description="Ask security questions, analyze threat concepts, audit code snippets, or execute security tools directly via Groq Llama-3.3 AI."
        icon={MessageSquare}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="gap-1.5 h-9 text-xs hover:text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear History
          </Button>
        }
      />

      <Card className="flex-1 flex flex-col overflow-hidden border-border/60 shadow-[var(--shadow-elegant)] bg-card/80 backdrop-blur-sm min-h-0">
        <ScrollArea className="flex-1 p-4 bg-card/30">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 max-w-lg mx-auto">
              <div className="h-12 w-12 rounded-2xl bg-accent/15 text-accent border border-accent/20 grid place-items-center mb-3 animate-glow-pulse">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-base" style={{ fontFamily: "Georgia, serif" }}>
                DefenSight AI Security Assistant
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Powered by Groq Llama-3.3 70B. Ask any cybersecurity question, request tool analysis, or pick a topic below:
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs w-full text-left">
                {[
                  { label: "Analyze news: [paste text]", action: "Analyze news: BREAKING: Major security patch released for critical zero-day vulnerability." },
                  { label: "Check URL: https://example.com", action: "Check URL: https://secure-login-account-update.info" },
                  { label: "What is SQL injection & how to prevent it?", action: "What is SQL injection and how do I prevent it in modern web apps?" },
                  { label: "Explain Business Email Compromise (BEC)", action: "Explain Business Email Compromise (BEC) and how gift card scams work." },
                  { label: "Best practices for API key security", action: "What are the best practices for storing and protecting API keys?" },
                  { label: "How does 2FA / MFA authentication work?", action: "How does 2FA / MFA authentication work under the hood?" },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setInput(item.action);
                    }}
                    className="p-3 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-accent/40 text-left transition-all group"
                  >
                    <div className="font-mono text-[11px] text-accent group-hover:underline">
                      {item.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-accent/15 text-accent border border-accent/20 grid place-items-center shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${msg.role === "user" ? "bg-accent text-accent-foreground shadow-sm" : "bg-muted/60 border border-border/40 text-foreground"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground border border-border/60 grid place-items-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="h-8 w-8 rounded-full bg-accent/15 text-accent border border-accent/20 grid place-items-center shrink-0"><Bot className="h-4 w-4" /></div>
                <div className="bg-muted/60 border border-border/40 rounded-xl px-4 py-2.5 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" /></div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 p-4 bg-muted/20">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a security question or audit request..." className="flex-1 h-10 text-xs font-mono" disabled={loading} />
            <Button type="submit" size="icon" className="h-10 w-10 bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function getCyberResponse(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("sql injection")) return "## SQL Injection\n\nSQL injection is a code injection technique that exploits vulnerabilities in an application's database layer. Attackers insert malicious SQL code into input fields to manipulate database queries.\n\n**Prevention:**\n- Use parameterized queries/prepared statements\n- Input validation and sanitization\n- Use ORM frameworks\n- Apply least privilege database permissions\n- Use Web Application Firewalls (WAF)";
  if (q.includes("xss") || q.includes("cross-site scripting")) return "## Cross-Site Scripting (XSS)\n\nXSS attacks inject malicious scripts into web pages viewed by other users.\n\n**Types:** Stored, Reflected, DOM-based\n\n**Prevention:**\n- Output encoding/escaping\n- Content Security Policy (CSP) headers\n- Input validation\n- Use modern frameworks with auto-escaping";
  if (q.includes("password")) return "## Password Security Best Practices\n\n- Use **12+ characters** minimum\n- Combine uppercase, lowercase, numbers, symbols\n- Never reuse passwords across sites\n- Use a **password manager**\n- Enable **2FA/MFA** wherever possible\n- Avoid dictionary words and personal info\n\nUse our **Password Lab** tool to test your password strength!";
  if (q.includes("phishing")) return "## Phishing Awareness\n\nPhishing uses deceptive emails, websites, or messages to steal sensitive information.\n\n**Red Flags:**\n- Urgent language (\"Act now!\")\n- Mismatched URLs\n- Generic greetings\n- Spelling/grammar errors\n- Suspicious attachments\n\n**Tip:** Use our **PhishGuard** tool to check suspicious URLs!";
  if (q.includes("ransomware")) return "## Ransomware\n\nRansomware encrypts your files and demands payment for the decryption key.\n\n**Prevention:**\n- Regular backups (3-2-1 rule)\n- Keep software updated\n- Email filtering\n- Network segmentation\n- Employee training\n- Endpoint detection and response (EDR)";
  if (q.includes("vpn")) return "## VPN (Virtual Private Network)\n\nA VPN encrypts your internet traffic and hides your IP address.\n\n**Benefits:**\n- Encrypted data transmission\n- IP address masking\n- Bypass geo-restrictions\n- Secure public Wi-Fi usage\n\n**Note:** A VPN doesn't make you completely anonymous — always use additional security measures.";
  return `## Cybersecurity Insight\n\nThat's a great question! Here are some general cybersecurity tips:\n\n1. **Keep software updated** — patches fix known vulnerabilities\n2. **Use strong, unique passwords** — try our Password Lab\n3. **Enable two-factor authentication** on all accounts\n4. **Be cautious with links and attachments** — use our PhishGuard\n5. **Regular backups** — follow the 3-2-1 rule\n6. **Stay informed** — analyze news with our News Analyzer\n\nFor a more specific answer, try asking about: SQL injection, XSS, phishing, ransomware, VPNs, or password security.`;
}
