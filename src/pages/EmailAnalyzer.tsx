import { useState, useMemo, useEffect } from "react";
import { analyzeEmailContent } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { saveScan } from "@/lib/firestore";
import { addScan } from "@/lib/scan-history";
import { riskFromScore } from "@/lib/threat-score";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AdvancedDetailsPanel } from "@/components/threat/AdvancedDetailsPanel";
import { ResultActions } from "@/components/threat/ResultActions";
import {
  ShieldAlert, ShieldCheck, ShieldX, Brain,
  TrendingUp, FileText, CheckCircle2, XCircle, HelpCircle, Loader2,
  Shuffle, Copy, Download, Trash2, History, BarChart3, AlertTriangle,
  Type, Hash, Clock, Globe, Share2, RotateCcw, Link2, ExternalLink, Mail
} from "lucide-react";
import { Link } from "react-router-dom";

type EmailAiResult = {
  verdict: "safe" | "suspicious" | "phishing" | string;
  confidence: number;
  risk_score: number;
  category: string;
  impersonation_target?: string;
  summary: string;
  red_flags: string[];
  safe_signals: string[];
  suspicious_urls: string[];
  recommended_actions: string[];
  recommendation: string;
  extracted_urls?: string[];
};

type HistoryItem = {
  id: string;
  ts: number;
  from: string;
  to: string;
  subject: string;
  bodyPreview: string;
  body: string;
  result: EmailAiResult;
};

const SAMPLE_EMAILS = [
  {
    label: "CEO Gift Card Scam",
    from: "CEO Office <exec-alert-desk@gmail.com>",
    to: "finance-team@yourcompany.com",
    subject: "URGENT: Purchase client gift cards immediately",
    body: "Hi team,\n\nI am currently in an urgent meeting with investors and cannot take calls. Please purchase five $200 Apple Gift Cards right away for client rewards. Scratch off the back codes and reply with photos of them immediately. I will process reimbursement once out of the meeting."
  },
  {
    label: "Netflix Account Suspended",
    from: "Netflix Support <billing@secure-login-account-update.info>",
    to: "subscriber@domain.com",
    subject: "Account Suspended: Payment Update Required",
    body: "Dear Customer,\n\nWe were unable to process your monthly membership payment. As a result, your account has been temporarily suspended. Please visit https://netflix-update-billing.secure-login-portal.info/update to verify your card details and restore access.\n\nThank you,\nNetflix Support"
  },
  {
    label: "HR Payroll Direct Deposit",
    from: "HR Benefits <portal-update@corp-benefits-mail.com>",
    to: "employee@yourcompany.com",
    subject: "ACTION REQUIRED: Update Direct Deposit Information",
    body: "Attention Employees,\n\nWe are updating our payroll provider this week. You must re-verify your direct deposit banking information before Friday at 5:00 PM EST to ensure your upcoming paycheck is delivered. Click here to log in: http://192.168.1.45/portal/login.html"
  },
  {
    label: "Legitimate GitHub Alert",
    from: "GitHub <noreply@github.com>",
    to: "dev@yourcompany.com",
    subject: "[GitHub] Security Alert: New login detected",
    body: "Hello,\n\nWe noticed a new login to your GitHub account from a Linux device in New York, US. If this was you, no action is needed. If you do not recognize this login, please visit your account settings to revoke the active session."
  }
];

const HISTORY_KEY = "defensight.email_ai.history.v1";

function verdictMeta(verdict: string) {
  const v = (verdict || "").toLowerCase();
  if (v === "phishing") {
    return {
      label: "Phishing Detected",
      Icon: ShieldX,
      color: "text-destructive",
      bg: "bg-destructive/10",
      ring: "ring-destructive/30",
      badgeCls: "bg-destructive/15 text-destructive border-destructive/30"
    };
  }
  if (v === "suspicious") {
    return {
      label: "Suspicious Email",
      Icon: ShieldAlert,
      color: "text-[oklch(0.62_0.18_75)]",
      bg: "bg-[oklch(0.62_0.18_75)]/10",
      ring: "ring-[oklch(0.62_0.18_75)]/30",
      badgeCls: "bg-[oklch(0.62_0.18_75)]/15 text-[oklch(0.45_0.18_75)] border-[oklch(0.62_0.18_75)]/30"
    };
  }
  return {
    label: "Safe / Legitimate",
    Icon: ShieldCheck,
    color: "text-[oklch(0.55_0.15_150)]",
    bg: "bg-[oklch(0.55_0.15_150)]/10",
    ring: "ring-[oklch(0.55_0.15_150)]/30",
    badgeCls: "bg-[oklch(0.55_0.15_150)]/15 text-[oklch(0.45_0.15_150)] border-[oklch(0.55_0.15_150)]/30"
  };
}

function emailMetrics(text: string, subject: string) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/) : [];
  const urls = (text.match(/https?:\/\/[^\s<>"')]+/gi) || []).length;
  const exclamations = (text.match(/!/g) || []).length;
  const allCapsWords = words.filter((w) => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)).length;
  return { words: words.length, urls, exclamations, allCapsWords, subjectLen: subject.length };
}

export default function EmailAnalyzer() {
  const { user } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailAiResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tab, setTab] = useState("analyze");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 25)));
    } catch {}
  }, [history]);

  const metrics = useMemo(() => emailMetrics(body, subject), [body, subject]);

  const run = async () => {
    if (body.trim().length < 20) {
      toast.error("Paste at least 20 characters of email content.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await analyzeEmailContent<EmailAiResult>({
        from: from.trim(),
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      setResult(r);

      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        from: from.trim(),
        to: to.trim(),
        subject: subject.trim(),
        bodyPreview: body.trim().slice(0, 100),
        body: body.trim(),
        result: r,
      };

      setHistory((h) => [newItem, ...h].slice(0, 25));

      const inputLabel = [from, to, subject].filter(Boolean).join(" → ") || body.slice(0, 80);
      addScan({
        type: "email_ai",
        input: inputLabel,
        result: r as unknown as Record<string, unknown>,
        threat_score: r.risk_score,
        risk_level: riskFromScore(r.risk_score),
      });

      if (user) saveScan(user.uid, { type: "email_ai", input: inputLabel, result: r }).catch(() => {});
      toast.success("Email audit complete");
    } catch (e: any) {
      toast.error(e?.message || "Email analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSampleClick = (s: typeof SAMPLE_EMAILS[0]) => {
    setFrom(s.from);
    setTo(s.to);
    setSubject(s.subject);
    setBody(s.body);
    toast.success(`Loaded sample: ${s.label}`);
  };

  const reset = () => {
    setFrom("");
    setTo("");
    setSubject("");
    setBody("");
    setResult(null);
  };

  const stats = useMemo(() => {
    const total = history.length;
    const phishing = history.filter((h) => h.result.verdict === "phishing").length;
    const suspicious = history.filter((h) => h.result.verdict === "suspicious").length;
    const safe = history.filter((h) => h.result.verdict === "safe" || h.result.verdict === "legitimate").length;
    const avgConf = total ? Math.round(history.reduce((a, h) => a + (h.result.confidence || 0), 0) / total) : 0;
    return { total, phishing, suspicious, safe, avgConf };
  }, [history]);

  return (
    <div className="bg-background text-foreground">
      <Toaster richColors position="top-center" />

      {/* Header Banner */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] defensight-shimmer-bg"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 32px)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 sm:pb-10">
          <div className="max-w-3xl">
            <Badge className="mb-5 bg-accent/10 text-accent border-accent/20" variant="outline">
              AI Security Suite
            </Badge>
            <h1
              className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]"
              style={{ fontFamily: "Georgia, 'Playfair Display', serif" }}
            >
              Scan emails <span className="italic text-accent">before</span> you click.
            </h1>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Detect credential phishing, BEC wire fraud, lookalike senders, malicious attachments, and deceptive links with LLM-powered deep semantic auditing.
            </p>
            <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 max-w-2xl">
              <DashStat icon={BarChart3} label="Analyses" value={stats.total} />
              <DashStat icon={ShieldX} label="Flagged Phishing" value={stats.phishing} accent="destructive" />
              <DashStat icon={ShieldAlert} label="Suspicious" value={stats.suspicious} accent="warning" />
              <DashStat icon={ShieldCheck} label="Verified Safe" value={stats.safe} accent="success" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="mb-5 -mx-4 sm:mx-0 overflow-x-auto">
            <TabsList className="mx-4 sm:mx-0">
              <TabsTrigger value="analyze" className="gap-1.5 sm:gap-2">
                <Brain className="h-4 w-4" /> Analyze Email
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 sm:gap-2">
                <History className="h-4 w-4" /> History{" "}
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {history.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="about" className="gap-1.5 sm:gap-2">
                <HelpCircle className="h-4 w-4" /> About
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analyze" className="mt-0 space-y-6">
            <Card className="p-4 sm:p-6 md:p-8 shadow-[var(--shadow-elegant)] border-border/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-4 w-4 text-accent" />
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Email Metadata & Content
                </span>
              </div>

              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      From (Sender)
                    </label>
                    <Input
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      placeholder="e.g., Netflix <billing@netflix-update.info>"
                      className="h-10 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      To (Recipient)
                    </label>
                    <Input
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="e.g., user@company.com"
                      className="h-10 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Subject
                    </label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Account Suspended - Action Required"
                      className="h-10 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Email Content / Body
                  </label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Paste full plain text email body content here..."
                    className="min-h-[180px] resize-y font-mono text-xs leading-relaxed"
                  />
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground">
                  <MetricChip icon={Type} label="words" value={metrics.words} />
                  <MetricChip icon={Link2} label="links found" value={metrics.urls} warn={metrics.urls > 0} />
                  <MetricChip icon={AlertTriangle} label="ALL-CAPS" value={metrics.allCapsWords} warn={metrics.allCapsWords > 3} />
                  <MetricChip icon={AlertTriangle} label="!" value={metrics.exclamations} warn={metrics.exclamations > 3} />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-1">Load sample:</span>
                    {SAMPLE_EMAILS.map((s) => (
                      <Button
                        key={s.label}
                        size="sm"
                        variant="outline"
                        onClick={() => handleSampleClick(s)}
                        className="text-xs h-8"
                      >
                        {s.label}
                      </Button>
                    ))}
                    {body && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={reset}
                        className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Clear
                      </Button>
                    )}
                  </div>

                  <Button
                    onClick={run}
                    disabled={loading}
                    size="lg"
                    className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 shadow-[var(--shadow-card)] sm:min-w-[180px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Auditing Email…
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" /> Analyze Email
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {loading && (
              <Card className="p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-xs text-muted-foreground font-mono">Running deep NLP email audit via Groq Llama-3.3...</p>
              </Card>
            )}

            {result && !loading && (
              <ResultPanel result={result} from={from} to={to} subject={subject} body={body} />
            )}

            {!result && !loading && (
              <div className="grid md:grid-cols-3 gap-4 mt-8">
                {[
                  {
                    icon: ShieldAlert,
                    title: "BEC & Spoofing Detection",
                    body: "Identifies lookalike domains, display-name spoofing, and CEO wire transfer impersonation patterns.",
                  },
                  {
                    icon: Link2,
                    title: "Malicious Link Audit",
                    body: "Extracts all embedded URLs and checks for credential harvest portals, IP hosts, and punycode domains.",
                  },
                  {
                    icon: Brain,
                    title: "AI Security Assessment",
                    body: "Uses Groq structured reasoning to deliver a calibrated risk score (0-100), red flags, and safe signals.",
                  },
                ].map((f) => (
                  <Card key={f.title} className="p-5 border-border/60 hover-card-rise transition-all">
                    <f.icon className="h-5 w-5 text-accent mb-3" />
                    <div className="font-semibold mb-1 text-sm">{f.title}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.body}</p>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <HistoryPanel
              history={history}
              onOpen={(h) => {
                setFrom(h.from);
                setTo(h.to);
                setSubject(h.subject);
                setBody(h.body);
                setResult(h.result);
                setTab("analyze");
              }}
              onClear={() => {
                setHistory([]);
                toast.success("Email analysis history cleared");
              }}
              onRemove={(id) => setHistory((arr) => arr.filter((h) => h.id !== id))}
            />
          </TabsContent>

          <TabsContent value="about" className="mt-0">
            <AboutPanel />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function ResultPanel({
  result,
  from,
  to,
  subject,
  body,
}: {
  result: EmailAiResult;
  from: string;
  to: string;
  subject: string;
  body: string;
}) {
  const meta = verdictMeta(result.verdict);
  const Icon = meta.Icon;

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ from, to, subject, body, result, exported_at: new Date().toISOString() }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `defensight-email-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const copyReport = async () => {
    const txt = `DefenSight Email Analysis Report\nVerdict: ${meta.label} (${result.confidence}% confidence)\nCategory: ${result.category}\nRisk Score: ${result.risk_score}/100\nImpersonation: ${result.impersonation_target || "None"}\n\nSummary: ${result.summary}\n\nRed flags:\n${result.red_flags?.map((r) => `- ${r}`).join("\n") || "- none"}\n\nSafe signals:\n${result.safe_signals?.map((r) => `- ${r}`).join("\n") || "- none"}\n\nRecommendation: ${result.recommendation}`;
    await navigator.clipboard.writeText(txt);
    toast.success("Report copied to clipboard");
  };

  const share = async () => {
    const text = `DefenSight Email audit: ${meta.label} (${result.confidence}% confidence, Risk: ${result.risk_score}/100) — ${result.summary}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "DefenSight Email Audit", text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Verdict copied to clipboard");
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className={`p-5 sm:p-6 md:p-8 border-2 ring-2 ${meta.ring} ${meta.bg}`}>
        <div className="flex items-start gap-4">
          <div className={`h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full grid place-items-center bg-background ${meta.color}`}>
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Analysis Verdict
            </div>
            <div className={`text-2xl sm:text-3xl font-bold ${meta.color}`} style={{ fontFamily: "Georgia, serif" }}>
              {meta.label} ({result.confidence}% confidence)
            </div>
            <p className="mt-2 text-foreground/90 leading-relaxed text-sm">{result.summary}</p>

            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1.5 font-mono">
                <span className="text-muted-foreground">Risk Score</span>
                <span className="font-semibold">{result.risk_score} / 100</span>
              </div>
              <Progress value={result.risk_score} className="h-2" />
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Stat label="Category" value={result.category?.replace(/_/g, " ")} />
              <Stat label="Impersonation" value={result.impersonation_target || "None"} />
              <Stat label="Extracted Links" value={`${result.extracted_urls?.length || result.suspicious_urls?.length || 0}`} />
              <Stat label="Confidence" value={`${result.confidence}%`} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyReport} className="gap-1.5 h-8 text-xs">
                <Copy className="h-3.5 w-3.5" /> Copy Report
              </Button>
              <Button size="sm" variant="outline" onClick={exportJson} className="gap-1.5 h-8 text-xs">
                <Download className="h-3.5 w-3.5" /> Export JSON
              </Button>
              <Button size="sm" variant="outline" onClick={share} className="gap-1.5 h-8 text-xs">
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-5">
        <Card className="p-6 border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold uppercase tracking-wide">Red Flags</span>
          </div>
          {result.red_flags?.length === 0 ? (
            <p className="text-xs text-muted-foreground">No suspicious indicators detected.</p>
          ) : (
            <ul className="space-y-2">
              {result.red_flags?.map((r, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <span className="text-destructive mt-0.5">▸</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-[oklch(0.55_0.15_150)]" />
            <span className="text-sm font-semibold uppercase tracking-wide">Safe Signals</span>
          </div>
          {result.safe_signals?.length === 0 ? (
            <p className="text-xs text-muted-foreground">No safe signals observed.</p>
          ) : (
            <ul className="space-y-2">
              {result.safe_signals?.map((s, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <span className="text-[oklch(0.55_0.15_150)] mt-0.5">▸</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {result.suspicious_urls && result.suspicious_urls.length > 0 && (
        <Card className="p-6 border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold uppercase tracking-wide">Flagged Suspicious Links</span>
          </div>
          <div className="space-y-2">
            {result.suspicious_urls.map((url) => (
              <div key={url} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded bg-destructive/5 border border-destructive/20 text-xs font-mono">
                <span className="break-all text-destructive font-semibold">{url}</span>
                <Link
                  to={`/phishing?q=${encodeURIComponent(url)}`}
                  className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline shrink-0"
                >
                  Inspect in PhishGuard <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 border-l-4 border-l-accent bg-muted/30">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Recommended Actions
        </div>
        <p className="text-xs leading-relaxed text-foreground/90 font-medium mb-3">{result.recommendation}</p>
        {result.recommended_actions?.length > 0 && (
          <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
            {result.recommended_actions.map((act, i) => (
              <li key={i}>{act}</li>
            ))}
          </ul>
        )}
      </Card>

      <AdvancedDetailsPanel data={result as unknown as Record<string, unknown>} />
    </div>
  );
}

function DashStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent?: "destructive" | "warning" | "success";
}) {
  const color =
    accent === "destructive"
      ? "text-destructive"
      : accent === "warning"
      ? "text-[oklch(0.62_0.18_75)]"
      : accent === "success"
      ? "text-[oklch(0.55_0.15_150)]"
      : "text-accent";
  return (
    <div className="rounded-md border border-border/60 bg-card/40 backdrop-blur px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className={`h-3 w-3 ${color}`} /> {label}
      </div>
      <div className="text-xl font-bold mt-0.5" style={{ fontFamily: "Georgia, serif" }}>
        {value}
      </div>
    </div>
  );
}

function MetricChip({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: any;
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
        warn ? "border-destructive/40 text-destructive bg-destructive/5" : "border-border/60 bg-muted/40"
      }`}
    >
      <Icon className="h-3 w-3" />
      <span className="font-semibold">{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-md bg-muted/50 border border-border/50">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold capitalize mt-0.5 truncate">{value || "—"}</div>
    </div>
  );
}

function HistoryPanel({
  history,
  onOpen,
  onClear,
  onRemove,
}: {
  history: HistoryItem[];
  onOpen: (h: HistoryItem) => void;
  onClear: () => void;
  onRemove: (id: string) => void;
}) {
  if (history.length === 0)
    return (
      <Card className="p-12 text-center border-dashed border-border/60">
        <History className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <div className="font-semibold mb-1 text-sm">No email audits yet</div>
        <p className="text-xs text-muted-foreground">Your past email scans will appear here for quick re-review.</p>
      </Card>
    );

  return (
    <Card className="p-5 border-border/60">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wide">Recent Email Audits</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="text-xs gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear history
        </Button>
      </div>
      <ScrollArea className="max-h-[480px]">
        <div className="space-y-2 pr-2">
          {history.map((h) => {
            const m = verdictMeta(h.result.verdict);
            return (
              <div
                key={h.id}
                className="group flex items-start gap-3 p-3 rounded-md border border-border/50 hover:border-accent/40 hover:bg-muted/30 transition-colors"
              >
                <div className={`h-9 w-9 shrink-0 rounded-md grid place-items-center ${m.bg} ${m.color}`}>
                  <m.Icon className="h-4 w-4" />
                </div>
                <button onClick={() => onOpen(h)} className="flex-1 text-left min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mb-0.5 font-mono">
                    <span className={`font-semibold ${m.color}`}>{m.label}</span>
                    <span>· Risk: {h.result.risk_score}/100</span>
                    {h.subject && <span className="truncate max-w-[200px]">"{h.subject}"</span>}
                    <span className="sm:ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <p className="text-xs truncate font-mono text-foreground/80">{h.bodyPreview}</p>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(h.id)}
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 h-7 w-7 p-0 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}

function AboutPanel() {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <Card className="p-6 border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold uppercase tracking-wide">How Email Analyzer Works</span>
        </div>
        <ol className="space-y-3 text-xs text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">1. Header & Domain Profiling.</span> Inspects sender display names, actual domain routing, and recipient targeting.
          </li>
          <li>
            <span className="font-semibold text-foreground">2. URL Extraction & Link Audit.</span> Pulls all embedded links to check for credential harvest domains, IP hosts, or brand spoofing.
          </li>
          <li>
            <span className="font-semibold text-foreground">3. LLM Semantic Reasoning.</span> Powered by Groq Llama-3.3-70b to detect urgency tactics, BEC gift-card scams, and wire transfer fraud.
          </li>
          <li>
            <span className="font-semibold text-foreground">4. Risk Calibration.</span> Synthesizes signals into a final score (0-100), red flags list, and actionable recommendations.
          </li>
        </ol>
      </Card>
      <Card className="p-6 border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-[oklch(0.55_0.15_150)]" />
          <span className="text-sm font-semibold uppercase tracking-wide">Phishing Indicators Inspected</span>
        </div>
        <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-5">
          <li>Executive & CEO gift-card wire-transfer scams (BEC).</li>
          <li>Lookalike domain spoofing and display-name mismatch.</li>
          <li>Account suspension scare tactics (Netflix, Apple, Banks).</li>
          <li>Credential harvesting links & fake login portals.</li>
          <li>Urgent pressure language and request for sensitive data.</li>
        </ul>
      </Card>
    </div>
  );
}
