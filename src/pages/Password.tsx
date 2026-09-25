import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { saveScan } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  KeyRound, ScanSearch, Shield, ShieldAlert, ShieldCheck, ShieldX,
  Eye, EyeOff, Copy, RefreshCw, Activity, Clock, AlertTriangle, CheckCircle2,
  Hash, Lock, Sparkles,
} from "lucide-react";

const COMMON = new Set(["password","123456","12345678","qwerty","abc123","111111","iloveyou","admin","welcome","monkey","dragon","letmein","password1","qwerty123","1q2w3e4r","sunshine","princess","football","baseball","starwars","master","shadow","superman","batman","trustno1","hello123","passw0rd"]);
const KB_SEQS = ["qwertyuiop","asdfghjkl","zxcvbnm","1234567890","abcdefghijklmnopqrstuvwxyz"];

function hasSequence(pw: string) {
  const lower = pw.toLowerCase();
  for (const seq of KB_SEQS) for (let i = 0; i <= seq.length - 4; i++) {
    const chunk = seq.slice(i, i + 4);
    if (lower.includes(chunk) || lower.includes(chunk.split("").reverse().join(""))) return true;
  }
  return false;
}
function hasRepeats(pw: string) { return /(.)\1{2,}/.test(pw); }

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "centuries";
  if (seconds < 1) return "instant";
  const units: [string, number][] = [["century", 60*60*24*365*100],["year", 60*60*24*365],["month", 60*60*24*30],["day", 60*60*24],["hour", 60*60],["minute", 60],["second", 1]];
  for (const [name, sec] of units) if (seconds >= sec) {
    const v = seconds / sec;
    if (v >= 1e6) return `${v.toExponential(1)} ${name}s`;
    const r = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    return `${r} ${name}${r === 1 ? "" : "s"}`;
  }
  return "instant";
}

function analyze(pw: string) {
  const length = pw.length;
  const charset = { lower: /[a-z]/.test(pw), upper: /[A-Z]/.test(pw), digit: /[0-9]/.test(pw), symbol: /[^a-zA-Z0-9\s]/.test(pw), unicode: /[^\x00-\x7F]/.test(pw) };
  let pool = 0;
  if (charset.lower) pool += 26;
  if (charset.upper) pool += 26;
  if (charset.digit) pool += 10;
  if (charset.symbol) pool += 33;
  if (charset.unicode) pool += 100;
  const entropy = length > 0 && pool > 0 ? +(length * Math.log2(pool)).toFixed(1) : 0;
  const warnings: string[] = []; const signals: string[] = [];
  if (length === 0) warnings.push("Empty password");
  if (length > 0 && length < 8) warnings.push("Very short (< 8 chars)");
  else if (length >= 8 && length < 12) warnings.push("Short — aim for 12+ chars");
  if (length >= 16) signals.push(`Strong length (${length} chars)`);
  if (charset.symbol) signals.push("Includes symbols");
  if (charset.upper && charset.lower) signals.push("Mixed case");
  if (charset.digit) signals.push("Includes digits");
  if (!charset.upper) warnings.push("No uppercase letters");
  if (!charset.digit) warnings.push("No digits");
  if (!charset.symbol) warnings.push("No symbols");
  if (COMMON.has(pw.toLowerCase())) warnings.push("Common password — instantly cracked");
  if (hasSequence(pw)) warnings.push("Contains keyboard sequence");
  if (hasRepeats(pw)) warnings.push("Contains repeated characters (aaa)");
  if (/^\d+$/.test(pw) && pw.length > 0) warnings.push("Digits only");
  if (/^[a-zA-Z]+$/.test(pw) && pw.length > 0) warnings.push("Letters only");
  let effective = entropy;
  if (COMMON.has(pw.toLowerCase())) effective = Math.min(effective, 8);
  if (hasSequence(pw)) effective -= 10;
  if (hasRepeats(pw)) effective -= 6;
  effective = Math.max(0, effective);
  const guesses = Math.pow(2, effective);
  const crackOnline = formatTime(guesses / 100);
  const crackOffline = formatTime(guesses / 1e10);
  let score: 0|1|2|3|4 = 0;
  if (effective >= 28) score = 1;
  if (effective >= 50) score = 2;
  if (effective >= 70) score = 3;
  if (effective >= 90) score = 4;
  if (length === 0) score = 0;
  const label = ["Empty","Very Weak","Weak","Fair","Strong","Excellent"][length === 0 ? 0 : score + 1] || "Weak";
  return { length, pool, entropy, score, label, crackOnline, crackOffline, warnings, signals, charset };
}

function scoreMeta(score: number, length: number) {
  if (length === 0) return { color: "text-muted-foreground", bg: "bg-muted/30", ring: "ring-border", icon: Shield };
  if (score <= 1) return { color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30", icon: ShieldX };
  if (score === 2) return { color: "text-[oklch(0.62_0.18_75)]", bg: "bg-[oklch(0.62_0.18_75)]/10", ring: "ring-[oklch(0.62_0.18_75)]/30", icon: ShieldAlert };
  if (score === 3) return { color: "text-[oklch(0.6_0.15_220)]", bg: "bg-[oklch(0.6_0.15_220)]/10", ring: "ring-[oklch(0.6_0.15_220)]/30", icon: Shield };
  return { color: "text-[oklch(0.55_0.15_150)]", bg: "bg-[oklch(0.55_0.15_150)]/10", ring: "ring-[oklch(0.55_0.15_150)]/30", icon: ShieldCheck };
}

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?/~";
const SIMILAR = /[O0Il1|`'"]/g;

function generate(opts: { length: number; upper: boolean; lower: boolean; digits: boolean; symbols: boolean; excludeSimilar: boolean }) {
  let pool = ""; const required: string[] = [];
  if (opts.lower) { pool += LOWER; required.push(LOWER); }
  if (opts.upper) { pool += UPPER; required.push(UPPER); }
  if (opts.digits) { pool += DIGITS; required.push(DIGITS); }
  if (opts.symbols) { pool += SYMBOLS; required.push(SYMBOLS); }
  if (opts.excludeSimilar) pool = pool.replace(SIMILAR, "");
  if (!pool) return "";
  const cleanReq = required.map((s) => (opts.excludeSimilar ? s.replace(SIMILAR, "") : s)).filter(Boolean);
  const buf = new Uint32Array(opts.length * 2);
  crypto.getRandomValues(buf);
  const chars: string[] = [];
  for (let i = 0; i < opts.length; i++) chars.push(pool[buf[i] % pool.length]);
  for (let i = 0; i < cleanReq.length && i < chars.length; i++) {
    const set = cleanReq[i];
    if (!chars.some((c) => set.includes(c))) chars[i] = set[buf[opts.length + i] % set.length];
  }
  const shuf = new Uint32Array(chars.length);
  crypto.getRandomValues(shuf);
  for (let i = chars.length - 1; i > 0; i--) { const j = shuf[i] % (i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

export default function Password() {
  const { user } = useAuth();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const a = useMemo(() => analyze(pw), [pw]);
  const meta = scoreMeta(a.score, a.length);
  const Icon = meta.icon;
  const [length, setLength] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeSimilar, setExcludeSimilar] = useState(false);
  const [generated, setGenerated] = useState("");

  const lastPersistedSig = useRef<string>("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    lastPersistedSig.current = "";
  }, [user?.uid]);

  const persistPasswordScan = useCallback(() => {
    if (!user || pw.trim().length < 4) return;
    const sig = `${pw.length}:${a.score}:${a.label}:${a.entropy}`;
    if (lastPersistedSig.current === sig) return;
    lastPersistedSig.current = sig;
    saveScan(user.uid, {
      type: "password",
      input: `Password check (${pw.length} characters — secret not stored)`,
      result: {
        verdict: a.label,
        label: a.label,
        score: a.score,
        entropy: a.entropy,
        crackOnline: a.crackOnline,
        crackOffline: a.crackOffline,
        charsetPool: a.pool,
        warnings: a.warnings.length,
        strengths: a.signals.length,
      },
    }).catch(() => {});
  }, [user, pw, a.score, a.label, a.entropy, a.pool, a.crackOnline, a.crackOffline, a.warnings.length, a.signals.length]);

  useEffect(() => {
    if (!user || pw.trim().length < 4) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      persistPasswordScan();
    }, 2200);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [user, pw, persistPasswordScan]);

  useEffect(() => { setGenerated(generate({ length, upper, lower, digits, symbols, excludeSimilar })); }, [length, upper, lower, digits, symbols, excludeSimilar]);

  const copy = async (text: string) => { if (!text) return; await navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); };
  const pct = a.length === 0 ? 0 : Math.min(100, (a.entropy / 128) * 100);

  return (
    <div className="bg-background text-foreground">
      <Toaster richColors position="top-center" />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 32px)" }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 sm:pb-10">
          <div className="max-w-3xl">
            <Badge className="mb-5 bg-accent/10 text-accent border-accent/20" variant="outline">Stay un-cracked</Badge>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]" style={{ fontFamily: "Georgia, 'Playfair Display', serif" }}>
              Forge <span className="italic text-accent">unbreakable</span> passwords.
            </h1>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Real-time entropy analysis, crack-time estimation against online + offline attackers, and a cryptographically secure generator — all running locally in your browser.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <Tabs defaultValue="analyze" className="w-full">
          <div className="mb-5 -mx-4 sm:mx-0 overflow-x-auto">
            <TabsList className="mx-4 sm:mx-0">
              <TabsTrigger value="analyze" className="gap-1.5 sm:gap-2"><Lock className="h-4 w-4" /> Analyze</TabsTrigger>
              <TabsTrigger value="generate" className="gap-1.5 sm:gap-2"><Sparkles className="h-4 w-4" /> Generate</TabsTrigger>
              <TabsTrigger value="tips" className="gap-1.5 sm:gap-2"><Shield className="h-4 w-4" /> Tips</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analyze" className="mt-0 space-y-5">
            <Card className="p-4 sm:p-6 md:p-8 shadow-[var(--shadow-elegant)] border-border/60">
              <div className="flex items-center gap-2 mb-4"><KeyRound className="h-4 w-4 text-accent" /><span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Password Input</span></div>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  onBlur={() => {
                    if (debounceTimer.current) {
                      clearTimeout(debounceTimer.current);
                      debounceTimer.current = null;
                    }
                    persistPasswordScan();
                  }}
                  placeholder="Type or paste a password to analyze…"
                  className="h-11 pr-12 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground" aria-label="Toggle password visibility">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">All analysis runs locally — your password is never sent anywhere.</p>
            </Card>

            <Card className={`p-5 sm:p-6 md:p-8 border-2 ring-2 ${meta.ring} ${meta.bg}`}>
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`h-11 w-11 sm:h-14 sm:w-14 shrink-0 rounded-full grid place-items-center bg-background ${meta.color}`}><Icon className="h-5 w-5 sm:h-7 sm:w-7" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Strength</div>
                  <div className={`text-2xl sm:text-3xl font-bold ${meta.color}`} style={{ fontFamily: "Georgia, serif" }}>{a.label}</div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1.5"><span className="text-muted-foreground">Entropy</span><span className="font-mono font-semibold">{a.entropy} bits</span></div>
                    <Progress value={pct} className="h-2" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Stat label="Length" value={a.length} />
                    <Stat label="Charset" value={a.pool} />
                    <Stat icon={Clock} label="Online crack" value={a.crackOnline} />
                    <Stat icon={Clock} label="Offline crack" value={a.crackOffline} />
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-5">
              <Card className="p-6 border-border/60">
                <div className="flex items-center gap-2 mb-4"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="text-sm font-semibold uppercase tracking-wide">Warnings</span></div>
                {a.warnings.length === 0 ? <p className="text-sm text-muted-foreground">No issues detected.</p> : <ul className="space-y-2">{a.warnings.map((w, i) => <li key={i} className="text-sm flex gap-2"><span className="text-destructive mt-1">▸</span><span>{w}</span></li>)}</ul>}
              </Card>
              <Card className="p-6 border-border/60">
                <div className="flex items-center gap-2 mb-4"><CheckCircle2 className="h-4 w-4 text-[oklch(0.55_0.15_150)]" /><span className="text-sm font-semibold uppercase tracking-wide">Strengths</span></div>
                {a.signals.length === 0 ? <p className="text-sm text-muted-foreground">No strong signals yet.</p> : <ul className="space-y-2">{a.signals.map((s, i) => <li key={i} className="text-sm flex gap-2"><span className="text-[oklch(0.55_0.15_150)] mt-1">▸</span><span>{s}</span></li>)}</ul>}
              </Card>
            </div>

            <Card className="p-6 border-border/60">
              <div className="flex items-center gap-2 mb-4"><Hash className="h-4 w-4 text-accent" /><span className="text-sm font-semibold uppercase tracking-wide">Character Classes</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Chip label="lowercase" on={a.charset.lower} />
                <Chip label="UPPERCASE" on={a.charset.upper} />
                <Chip label="digits" on={a.charset.digit} />
                <Chip label="symbols" on={a.charset.symbol} />
                <Chip label="unicode" on={a.charset.unicode} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="generate" className="mt-0 space-y-5">
            <Card className="p-4 sm:p-6 md:p-8 shadow-[var(--shadow-elegant)] border-border/60">
              <div className="flex items-center gap-2 mb-4"><Sparkles className="h-4 w-4 text-accent" /><span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Generated Password</span></div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={generated} readOnly className="h-11 flex-1 font-mono text-sm" />
                <div className="flex gap-2">
                  <Button onClick={() => copy(generated)} variant="outline" className="gap-1.5 h-11"><Copy className="h-4 w-4" /> Copy</Button>
                  <Button onClick={() => setGenerated(generate({ length, upper, lower, digits, symbols, excludeSimilar }))} className="gap-1.5 h-11 bg-accent text-accent-foreground hover:bg-accent/90"><RefreshCw className="h-4 w-4" /> Regenerate</Button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Entropy: <span className="font-mono font-semibold text-foreground">{analyze(generated).entropy} bits</span></span>
                <span>·</span>
                <span>Length: <span className="font-mono font-semibold text-foreground">{generated.length}</span></span>
              </div>
            </Card>

            <Card className="p-6 border-border/60 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2"><Label className="text-sm font-semibold">Length</Label><span className="font-mono text-sm">{length}</span></div>
                <Slider value={[length]} onValueChange={(v) => setLength(v[0])} min={4} max={64} step={1} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <ToggleRow label="Lowercase (a–z)" checked={lower} onChange={setLower} />
                <ToggleRow label="Uppercase (A–Z)" checked={upper} onChange={setUpper} />
                <ToggleRow label="Digits (0–9)" checked={digits} onChange={setDigits} />
                <ToggleRow label="Symbols (!@#$…)" checked={symbols} onChange={setSymbols} />
                <ToggleRow label="Exclude look-alikes (O/0, l/1)" checked={excludeSimilar} onChange={setExcludeSimilar} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="tips" className="mt-0">
            <div className="grid md:grid-cols-2 gap-5">
              <Card className="p-6 border-border/60">
                <div className="flex items-center gap-2 mb-3"><Shield className="h-4 w-4 text-accent" /><span className="text-sm font-semibold uppercase tracking-wide">Best practices</span></div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                  <li>Use 16+ characters with mixed classes — entropy beats complexity tricks.</li>
                  <li>Never reuse passwords across sites; use a password manager.</li>
                  <li>Enable multi-factor authentication wherever available.</li>
                  <li>Avoid names, dates, and dictionary words even with leetspeak.</li>
                </ul>
              </Card>
              <Card className="p-6 border-border/60">
                <div className="flex items-center gap-2 mb-3"><Activity className="h-4 w-4 text-[oklch(0.55_0.15_150)]" /><span className="text-sm font-semibold uppercase tracking-wide">How we estimate</span></div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                  <li>Entropy = length × log₂(character pool size).</li>
                  <li>Online attack ≈ 100 guesses/sec (rate-limited login).</li>
                  <li>Offline attack ≈ 10 billion guesses/sec (modern GPU on stolen hash).</li>
                  <li>Penalties for common passwords, sequences (qwerty, 1234), and repeats.</li>
                </ul>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>

    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon?: any; label: string; value: string | number }) {
  return (
    <div className="px-3 py-2 rounded-md bg-muted/50 border border-border/50">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">{Icon && <Icon className="h-3 w-3" />} {label}</div>
      <div className="text-sm font-semibold mt-0.5 truncate">{String(value)}</div>
    </div>
  );
}
function Chip({ label, on }: { label: string; on: boolean }) {
  return <div className={`px-3 py-2 rounded-md border text-xs font-mono text-center ${on ? "border-[oklch(0.55_0.15_150)]/40 bg-[oklch(0.55_0.15_150)]/10 text-[oklch(0.55_0.15_150)]" : "border-border/60 bg-muted/30 text-muted-foreground"}`}>{on ? "✓ " : "× "}{label}</div>;
}
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-border/60 bg-muted/20 cursor-pointer"><span className="text-sm">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></label>;
}
