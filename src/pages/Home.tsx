import { useState, useMemo, useEffect } from "react";
import { analyzeNewsArticle } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { saveScan } from "@/lib/firestore";
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
import {
  ShieldCheck, AlertTriangle, ScanSearch, Brain,
  TrendingUp, FileText, CheckCircle2, XCircle, HelpCircle, Loader2,
  Shuffle, Copy, Download, Trash2, History, BarChart3, Activity,
  Type, Hash, Clock, Globe, Share2, RotateCcw,
} from "lucide-react";

type Verdict = "likely_real" | "uncertain" | "likely_fake";
type Claim = { claim: string; verifiability: "verifiable" | "unverifiable" | "false" | "misleading" };
type Result = {
  verdict: Verdict; confidence: number; summary: string;
  red_flags: string[]; credibility_signals: string[];
  sentiment: string; bias: string; key_claims: Claim[]; recommendation: string;
};
type HistoryItem = { id: string; ts: number; preview: string; source: string; content: string; result: Result };

const SAMPLE_POOL: { label: string; tone: "fake" | "real" | "mixed"; text: string }[] = [
  { label: "Miracle cure", tone: "fake", text: "SHOCKING!!! Scientists CONFIRM that drinking lemon water at 4AM cures ALL diseases — Big Pharma DOESN'T want you to know this ONE simple trick that doctors HATE!!!" },
  { label: "Celebrity hoax", tone: "fake", text: "BREAKING: Famous actor Tom Hanks SECRETLY ARRESTED last night in Los Angeles, mainstream media REFUSES to report it. Insider sources say authorities seized 'shocking documents'. SHARE before they DELETE this!!" },
  { label: "Conspiracy post", tone: "fake", text: "Wake up sheeple!! The government is hiding the TRUTH about 5G towers — they emit MIND CONTROL frequencies proven by REAL scientists. Big Tech censors anyone who speaks up. Do your own research!!!" },
  { label: "ECB rate hold", tone: "real", text: "The European Central Bank announced on Thursday that it will hold interest rates steady at 4.0%, citing easing inflation but persistent wage pressures. The decision was unanimous, according to a statement released after the policy meeting." },
  { label: "NASA mission", tone: "real", text: "NASA confirmed on Tuesday that its Europa Clipper spacecraft completed a successful gravity assist around Mars, putting it on track for a 2030 arrival at Jupiter's icy moon Europa. Mission engineers reported all systems operating nominally." },
  { label: "Court ruling", tone: "real", text: "The Supreme Court of India ruled on Friday in a 4-1 decision to uphold the constitutional validity of the 2024 data protection amendment, with the majority opinion authored by Justice Khanna. Implementation is scheduled for January." },
  { label: "Mixed framing", tone: "mixed", text: "Local officials announced a new public transport plan that critics say will 'devastate' small businesses. Supporters counter that ridership projections show a 30% increase. The plan goes to a vote next month, with passions running high on both sides." },
  { label: "Opinion column", tone: "mixed", text: "It is becoming impossible to ignore that the new education policy is a disaster waiting to happen. While the ministry claims test scores will rise, anyone with common sense can see the writing on the wall — our schools deserve better." },
];

function pickRandomSamples(count = 3) {
  const shuffled = [...SAMPLE_POOL].sort(() => Math.random() - 0.5);
  const picked: typeof SAMPLE_POOL = [];
  const tones = new Set<string>();
  for (const s of shuffled) if (picked.length < count && !tones.has(s.tone)) { picked.push(s); tones.add(s.tone); }
  for (const s of shuffled) { if (picked.length >= count) break; if (!picked.includes(s)) picked.push(s); }
  return picked;
}

function textMetrics(text: string) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/) : [];
  const sentences = trimmed ? trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0) : [];
  const exclamations = (text.match(/!/g) || []).length;
  const questions = (text.match(/\?/g) || []).length;
  const allCapsWords = words.filter((w) => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)).length;
  const avgWordLen = words.length ? words.reduce((a, w) => a + w.length, 0) / words.length : 0;
  return { chars: text.length, words: words.length, sentences: sentences.length, exclamations, questions, allCapsWords, avgWordLen: Number(avgWordLen.toFixed(1)), readingMin: Math.max(1, Math.round(words.length / 200)) };
}

const HISTORY_KEY = "truthlens.history.v1";

function verdictMeta(v: Verdict) {
  if (v === "likely_real") return { label: "Likely Real", icon: CheckCircle2, color: "text-[oklch(0.55_0.15_150)]", bg: "bg-[oklch(0.55_0.15_150)]/10", ring: "ring-[oklch(0.55_0.15_150)]/30" };
  if (v === "likely_fake") return { label: "Likely Fake", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30" };
  return { label: "Uncertain", icon: HelpCircle, color: "text-[oklch(0.62_0.18_75)]", bg: "bg-[oklch(0.62_0.18_75)]/10", ring: "ring-[oklch(0.62_0.18_75)]/30" };
}

export default function Home() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [samples, setSamples] = useState(() => pickRandomSamples(3));
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tab, setTab] = useState("analyze");

  useEffect(() => { try { const raw = localStorage.getItem(HISTORY_KEY); if (raw) setHistory(JSON.parse(raw)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 25))); } catch {} }, [history]);

  const metrics = useMemo(() => textMetrics(content), [content]);

  const analyze = async () => {
    if (content.trim().length < 20) { toast.error("Paste at least 20 characters of news text."); return; }
    setLoading(true); setResult(null);
    try {
      const r = await analyzeNewsArticle<Result>({ content, source });
      setResult(r);
      setHistory((h) => [{ id: crypto.randomUUID(), ts: Date.now(), preview: content.trim().slice(0, 120), source, content, result: r }, ...h].slice(0, 25));
      if (user) saveScan(user.uid, { type: "news", input: content.slice(0, 500), source, result: r }).catch(() => {});
      toast.success("Analysis complete");
    } catch (e: any) { toast.error(e?.message || "Analysis failed"); } finally { setLoading(false); }
  };

  const reshuffle = () => { setSamples(pickRandomSamples(3)); toast.success("New samples loaded"); };
  const reset = () => { setContent(""); setSource(""); setResult(null); };

  const stats = useMemo(() => {
    const total = history.length;
    const fake = history.filter((h) => h.result.verdict === "likely_fake").length;
    const real = history.filter((h) => h.result.verdict === "likely_real").length;
    const uncertain = history.filter((h) => h.result.verdict === "uncertain").length;
    const avgConf = total ? Math.round(history.reduce((a, h) => a + h.result.confidence, 0) / total) : 0;
    return { total, fake, real, uncertain, avgConf };
  }, [history]);

  return (
    <div className="bg-background text-foreground">
      <Toaster richColors position="top-center" />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 32px)" }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 sm:pb-10">
          <div className="max-w-3xl">
            <Badge className="mb-5 bg-accent/10 text-accent border-accent/20" variant="outline">Verify before you share</Badge>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]" style={{ fontFamily: "Georgia, 'Playfair Display', serif" }}>
              Spot fake news <span className="italic text-accent">before</span> it spreads.
            </h1>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Paste any article, headline, or social post. Our NLP engine inspects sentiment, bias, sensationalism, and claim verifiability — then delivers a calibrated verdict in seconds.
            </p>
            <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 max-w-2xl">
              <DashStat icon={BarChart3} label="Analyses" value={stats.total} />
              <DashStat icon={XCircle} label="Flagged fake" value={stats.fake} accent="destructive" />
              <DashStat icon={CheckCircle2} label="Verified real" value={stats.real} accent="success" />
              <DashStat icon={TrendingUp} label="Avg confidence" value={`${stats.avgConf}%`} />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="mb-5 -mx-4 sm:mx-0 overflow-x-auto">
            <TabsList className="mx-4 sm:mx-0">
              <TabsTrigger value="analyze" className="gap-1.5 sm:gap-2"><Brain className="h-4 w-4" /> Analyze</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 sm:gap-2"><History className="h-4 w-4" /> History <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{history.length}</Badge></TabsTrigger>
              <TabsTrigger value="about" className="gap-1.5 sm:gap-2"><HelpCircle className="h-4 w-4" /> About</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analyze" className="mt-0">
            <Card className="p-4 sm:p-6 md:p-8 shadow-[var(--shadow-elegant)] border-border/60">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-accent" />
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Article Input</span>
              </div>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source URL or publisher (optional)" className="mb-3 h-11" />
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste the news article, headline, or claim here…" className="min-h-[200px] resize-y font-mono text-sm leading-relaxed" />
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground">
                <MetricChip icon={Type} label="words" value={metrics.words} />
                <MetricChip icon={Hash} label="sentences" value={metrics.sentences} />
                <MetricChip icon={Clock} label="read" value={`${metrics.readingMin}m`} />
                <MetricChip icon={AlertTriangle} label="ALL-CAPS" value={metrics.allCapsWords} warn={metrics.allCapsWords > 3} />
                <MetricChip icon={AlertTriangle} label="!" value={metrics.exclamations} warn={metrics.exclamations > 3} />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">Try a sample:</span>
                  {samples.map((s) => (
                    <Button key={s.label} size="sm" variant="outline" onClick={() => setContent(s.text)} className="text-xs h-8">
                      {s.label}
                      <span className={`ml-1.5 h-1.5 w-1.5 rounded-full ${s.tone === "fake" ? "bg-destructive" : s.tone === "real" ? "bg-[oklch(0.55_0.15_150)]" : "bg-[oklch(0.62_0.18_75)]"}`} />
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={reshuffle} className="text-xs h-8 gap-1.5"><Shuffle className="h-3.5 w-3.5" /> Shuffle</Button>
                  {content && <Button size="sm" variant="ghost" onClick={reset} className="text-xs h-8 gap-1.5 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" /> Clear</Button>}
                </div>
                <Button onClick={analyze} disabled={loading} size="lg" className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 shadow-[var(--shadow-card)] sm:min-w-[180px]">
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</> : <><Brain className="h-4 w-4 mr-2" /> Analyze Article</>}
                </Button>
              </div>
            </Card>

            {result && <ResultPanel result={result} content={content} source={source} />}

            {!result && !loading && (
              <div className="grid md:grid-cols-3 gap-4 mt-10">
                {[
                  { icon: Brain, title: "Linguistic Analysis", body: "Detects sensationalism, ALL-CAPS, loaded language, and emotional manipulation patterns." },
                  { icon: TrendingUp, title: "Bias & Sentiment", body: "Classifies framing along bias and sentiment axes used by professional fact-checkers." },
                  { icon: ShieldCheck, title: "Claim Verification", body: "Extracts factual claims and labels each as verifiable, misleading, or unsupported." },
                ].map((f) => (
                  <Card key={f.title} className="p-5 border-border/60 hover:border-accent/40 transition-colors">
                    <f.icon className="h-5 w-5 text-accent mb-3" />
                    <div className="font-semibold mb-1">{f.title}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <HistoryPanel
              history={history}
              onOpen={(h) => { setContent(h.content); setSource(h.source); setResult(h.result); setTab("analyze"); }}
              onClear={() => { setHistory([]); toast.success("History cleared"); }}
              onRemove={(id) => setHistory((arr) => arr.filter((h) => h.id !== id))}
            />
          </TabsContent>

          <TabsContent value="about" className="mt-0"><AboutPanel /></TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function ResultPanel({ result, content, source }: { result: Result; content: string; source: string }) {
  const meta = verdictMeta(result.verdict);
  const Icon = meta.icon;
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ source, content, result, exported_at: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `defensight-report-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };
  const copyReport = async () => {
    const txt = `DefenSight Report\nVerdict: ${meta.label} (${result.confidence}%)\nSentiment: ${result.sentiment} | Bias: ${result.bias}\n\nSummary: ${result.summary}\n\nRed flags:\n${result.red_flags.map((r) => `- ${r}`).join("\n") || "- none"}\n\nCredibility signals:\n${result.credibility_signals.map((r) => `- ${r}`).join("\n") || "- none"}\n\nRecommendation: ${result.recommendation}`;
    await navigator.clipboard.writeText(txt); toast.success("Report copied to clipboard");
  };
  const share = async () => {
    const text = `DefenSight verdict: ${meta.label} (${result.confidence}% confidence) — ${result.summary}`;
    if (navigator.share) { try { await navigator.share({ title: "DefenSight analysis", text }); } catch {} }
    else { await navigator.clipboard.writeText(text); toast.success("Verdict copied — share away"); }
  };
  return (
    <div className="mt-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className={`p-5 sm:p-6 md:p-8 border-2 ring-2 ${meta.ring} ${meta.bg}`}>
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`h-11 w-11 sm:h-14 sm:w-14 shrink-0 rounded-full grid place-items-center bg-background ${meta.color}`}><Icon className="h-5 w-5 sm:h-7 sm:w-7" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Verdict</div>
            <div className={`text-2xl sm:text-3xl font-bold ${meta.color}`} style={{ fontFamily: "Georgia, serif" }}>{meta.label}</div>
            <p className="mt-2 text-foreground/90 leading-relaxed">{result.summary}</p>
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1.5"><span className="text-muted-foreground">Confidence</span><span className="font-mono font-semibold">{result.confidence}%</span></div>
              <Progress value={result.confidence} className="h-2" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyReport} className="gap-1.5 h-8 text-xs"><Copy className="h-3.5 w-3.5" /> Copy</Button>
              <Button size="sm" variant="outline" onClick={exportJson} className="gap-1.5 h-8 text-xs"><Download className="h-3.5 w-3.5" /> Export JSON</Button>
              <Button size="sm" variant="outline" onClick={share} className="gap-1.5 h-8 text-xs"><Share2 className="h-3.5 w-3.5" /> Share</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-5">
        <Card className="p-6 border-border/60">
          <div className="flex items-center gap-2 mb-4"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="text-sm font-semibold uppercase tracking-wide">Red Flags</span></div>
          {result.red_flags.length === 0 ? <p className="text-sm text-muted-foreground">None detected.</p> : <ul className="space-y-2">{result.red_flags.map((r, i) => <li key={i} className="text-sm flex gap-2"><span className="text-destructive mt-1">▸</span><span>{r}</span></li>)}</ul>}
        </Card>
        <Card className="p-6 border-border/60">
          <div className="flex items-center gap-2 mb-4"><ShieldCheck className="h-4 w-4 text-[oklch(0.55_0.15_150)]" /><span className="text-sm font-semibold uppercase tracking-wide">Credibility Signals</span></div>
          {result.credibility_signals.length === 0 ? <p className="text-sm text-muted-foreground">None detected.</p> : <ul className="space-y-2">{result.credibility_signals.map((r, i) => <li key={i} className="text-sm flex gap-2"><span className="text-[oklch(0.55_0.15_150)] mt-1">▸</span><span>{r}</span></li>)}</ul>}
        </Card>
      </div>

      <Card className="p-6 border-border/60">
        <div className="flex flex-wrap gap-3 mb-5">
          <Stat label="Sentiment" value={result.sentiment} />
          <Stat label="Bias" value={result.bias} />
        </div>
        <div className="flex items-center gap-2 mb-3"><FileText className="h-4 w-4 text-accent" /><span className="text-sm font-semibold uppercase tracking-wide">Key Claims</span></div>
        <div className="space-y-2">
          {result.key_claims.map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/40 border border-border/40">
              <ClaimBadge v={c.verifiability} />
              <p className="text-sm flex-1">{c.claim}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 border-l-4 border-l-accent bg-muted/30">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Recommendation</div>
        <p className="text-sm leading-relaxed">{result.recommendation}</p>
      </Card>
    </div>
  );
}

function DashStat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: "destructive" | "success" }) {
  const color = accent === "destructive" ? "text-destructive" : accent === "success" ? "text-[oklch(0.55_0.15_150)]" : "text-accent";
  return (
    <div className="rounded-md border border-border/60 bg-card/40 backdrop-blur px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground"><Icon className={`h-3 w-3 ${color}`} /> {label}</div>
      <div className="text-xl font-bold mt-0.5" style={{ fontFamily: "Georgia, serif" }}>{value}</div>
    </div>
  );
}

function MetricChip({ icon: Icon, label, value, warn }: { icon: any; label: string; value: number | string; warn?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${warn ? "border-destructive/40 text-destructive bg-destructive/5" : "border-border/60 bg-muted/40"}`}>
      <Icon className="h-3 w-3" /><span className="font-semibold">{value}</span><span className="opacity-70">{label}</span>
    </span>
  );
}

function HistoryPanel({ history, onOpen, onClear, onRemove }: { history: HistoryItem[]; onOpen: (h: HistoryItem) => void; onClear: () => void; onRemove: (id: string) => void }) {
  if (history.length === 0) return (
    <Card className="p-12 text-center border-dashed border-border/60">
      <History className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
      <div className="font-semibold mb-1">No analyses yet</div>
      <p className="text-sm text-muted-foreground">Your past verdicts will appear here for quick re-review.</p>
    </Card>
  );
  return (
    <Card className="p-5 border-border/60">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-accent" /><span className="text-sm font-semibold uppercase tracking-wide">Recent analyses</span></div>
        <Button size="sm" variant="ghost" onClick={onClear} className="text-xs gap-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Clear all</Button>
      </div>
      <ScrollArea className="max-h-[480px]">
        <div className="space-y-2 pr-2">
          {history.map((h) => {
            const m = verdictMeta(h.result.verdict);
            return (
              <div key={h.id} className="group flex items-start gap-3 p-3 rounded-md border border-border/50 hover:border-accent/40 hover:bg-muted/30 transition-colors">
                <div className={`h-9 w-9 shrink-0 rounded-md grid place-items-center ${m.bg} ${m.color}`}><m.icon className="h-4 w-4" /></div>
                <button onClick={() => onOpen(h)} className="flex-1 text-left min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mb-0.5">
                    <span className={`font-semibold ${m.color}`}>{m.label}</span>
                    <span>· {h.result.confidence}%</span>
                    {h.source && <><span>·</span><Globe className="h-3 w-3" /><span className="truncate max-w-[160px] sm:max-w-[200px]">{h.source}</span></>}
                    <span className="sm:ml-auto font-mono">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <p className="text-sm truncate">{h.preview}</p>
                </button>
                <Button size="sm" variant="ghost" onClick={() => onRemove(h.id)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 h-7 w-7 p-0 shrink-0"><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <div className="flex items-center gap-2 mb-3"><Brain className="h-4 w-4 text-accent" /><span className="text-sm font-semibold uppercase tracking-wide">How DefenSight works</span></div>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li><span className="font-semibold text-foreground">1. Tokenize & profile.</span> Your text is broken down into linguistic features.</li>
          <li><span className="font-semibold text-foreground">2. Reason with an LLM.</span> A Gemini model evaluates sentiment, bias, source cues, and factual plausibility.</li>
          <li><span className="font-semibold text-foreground">3. Extract claims.</span> Atomic claims are pulled out and individually labeled.</li>
          <li><span className="font-semibold text-foreground">4. Calibrate verdict.</span> A weighted score across all signals produces the final verdict.</li>
        </ol>
      </Card>
      <Card className="p-6 border-border/60">
        <div className="flex items-center gap-2 mb-3"><ShieldCheck className="h-4 w-4 text-[oklch(0.55_0.15_150)]" /><span className="text-sm font-semibold uppercase tracking-wide">Limitations</span></div>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Results are probabilistic — never definitive proof of truth or falsehood.</li>
          <li>Very recent events may sit outside the model's knowledge window.</li>
          <li>Satire and opinion may be flagged for bias; that is by design.</li>
          <li>Always cross-reference with primary sources before sharing.</li>
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-md bg-muted/50 border border-border/50">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold capitalize">{value.replace(/_/g, " ")}</div>
    </div>
  );
}

function ClaimBadge({ v }: { v: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    verifiable: { label: "Verifiable", cls: "bg-[oklch(0.55_0.15_150)]/15 text-[oklch(0.45_0.15_150)] border-[oklch(0.55_0.15_150)]/30" },
    unverifiable: { label: "Unverifiable", cls: "bg-muted text-muted-foreground border-border" },
    misleading: { label: "Misleading", cls: "bg-[oklch(0.62_0.18_75)]/15 text-[oklch(0.45_0.18_75)] border-[oklch(0.62_0.18_75)]/30" },
    false: { label: "False", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const m = map[v?.toLowerCase?.()] ?? { label: String(v || "unknown"), cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border whitespace-nowrap ${m.cls}`}>{m.label}</span>;
}

