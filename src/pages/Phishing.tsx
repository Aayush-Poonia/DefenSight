import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { intelApi, type PhishIntelResult } from "@/lib/intel-api";
import { addScan } from "@/lib/scan-history";
import { ThreatScorePanel } from "@/components/threat/ThreatScorePanel";
import { FieldRow, ResultActions } from "@/components/threat/ResultActions";
import { AdvancedDetailsPanel } from "@/components/threat/AdvancedDetailsPanel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Globe, Loader2, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { riskStyles } from "@/lib/threat-score";

function statusMeta(status: string) {
  if (status === "phishing")
    return { label: "Phishing", Icon: ShieldX, className: "text-destructive bg-destructive/10" };
  if (status === "suspicious")
    return {
      label: "Suspicious",
      Icon: ShieldAlert,
      className: "text-amber-500 bg-amber-500/10",
    };
  return {
    label: "Clean",
    Icon: ShieldCheck,
    className: "text-emerald-500 bg-emerald-500/10",
  };
}

export default function Phishing() {
  const [params] = useSearchParams();
  const [url, setUrl] = useState(params.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhishIntelResult | null>(null);

  const run = async (value = url) => {
    if (!value.trim()) {
      toast.error("Enter a URL to investigate");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await intelApi.phishingIntel(value.trim());
      setResult(r);
      addScan({
        type: "phishing",
        input: value.trim(),
        result: r as unknown as Record<string, unknown>,
        threat_score: r.threat_score,
        risk_level: r.risk_level,
      });
      toast.success("Investigation complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Investigation failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q) {
      setUrl(q);
      run(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = result ? statusMeta(result.phishing_status) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Toaster richColors position="top-center" />

      <div>
        <Badge variant="outline" className="mb-2">
          PhishGuard
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="h-7 w-7" /> URL Investigation
        </h1>
        <p className="text-muted-foreground mt-1">
          DNSDumpster, Censys Host Intel, URLScan, Safe Browsing, VirusTotal, PhishStats, WHOIS, URLhaus, OTX & ThreatFox
        </p>
      </div>

      <Card className="p-4 sm:p-5 flex flex-col sm:flex-row gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && run()}
          placeholder="https://suspicious-example.com/login"
          className="h-11 font-mono text-sm"
        />
        <Button className="h-11 min-w-[140px]" disabled={loading} onClick={() => run()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Investigate"}
        </Button>
      </Card>

      {loading && (
        <Card className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm">Running threat intelligence correlation…</p>
        </Card>
      )}

      {result && !loading && meta && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${meta.className}`}
            >
              <meta.Icon className="h-4 w-4" />
              Phishing Status: {meta.label}
            </div>
            <ResultActions
              type="phishing"
              input={result.url}
              result={result as unknown as Record<string, unknown>}
            />
          </div>

          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <Card className="overflow-hidden p-0 border-border/60 shadow-xs">
              <div className="px-4 py-3 border-b border-border/60 text-xs font-semibold flex items-center justify-between bg-muted/30">
                <span className="uppercase tracking-wider text-muted-foreground font-mono">Website Visual Screenshot</span>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-mono"
                >
                  Visit Site ↗
                </a>
              </div>
              <div className="relative min-h-[220px] bg-muted/20 flex items-center justify-center overflow-hidden">
                <img
                  src={result.screenshot && !result.screenshot.includes("mshots") && !result.screenshot.includes("thum.io") ? result.screenshot : `https://api.microlink.io/?url=${encodeURIComponent(result.url)}&screenshot=true&embed=screenshot.url`}
                  alt={`Screenshot preview for ${result.domain}`}
                  className="w-full max-h-[360px] object-cover object-top transition-opacity duration-300"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    const fallbackUrl = `https://mini.s-shot.ru/1024x768/800/jpeg/?${encodeURIComponent(result.url)}`;
                    if (img.src !== fallbackUrl) {
                      img.src = fallbackUrl;
                    }
                  }}
                />
              </div>
            </Card>
            <ThreatScorePanel threat={result.threat} />
          </div>

          <Card className="p-4 sm:p-5 space-y-1">
            <h3 className="font-semibold mb-2">Domain Intelligence</h3>
            <FieldRow label="Domain" value={result.domain} />
            <FieldRow label="Domain Age" value={result.domain_age} />
            <FieldRow label="Registrar" value={result.registrar} />
            <FieldRow label="Registered" value={result.registration_date} />
            <FieldRow label="Expiration" value={result.expiration_date} />
            <FieldRow
              label="Nameservers"
              value={result.nameservers?.length ? result.nameservers.join(", ") : "—"}
            />
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4 sm:p-5">
              <h3 className="font-semibold mb-3">Technologies Used</h3>
              {result.technologies?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.technologies.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No technology fingerprints returned</p>
              )}
            </Card>
            <Card className="p-4 sm:p-5">
              <h3 className="font-semibold mb-3">Redirect Chain</h3>
              {result.redirect_chain?.length ? (
                <ol className="space-y-2 text-sm font-mono break-all list-decimal list-inside">
                  {result.redirect_chain.map((u, i) => (
                    <li key={`${u}-${i}`}>{u}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No redirect chain detected</p>
              )}
            </Card>
          </div>

          <Card className="p-4 sm:p-5">
            <h3 className="font-semibold mb-3">Risk Breakdown</h3>
            {result.risk_breakdown?.length ? (
              <div className="space-y-2">
                {result.risk_breakdown.map((b) => (
                  <div key={b.factor} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{b.factor}</span>
                    <span className={`font-mono ${riskStyles(result.risk_level).text}`}>
                      +{b.points}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No elevated risk factors</p>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h3 className="font-semibold mb-3">Recommendations</h3>
            <ul className="space-y-2">
              {result.recommendations.map((r) => (
                <li key={r} className="text-sm flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Card>

          <AdvancedDetailsPanel data={result as unknown as Record<string, unknown>} />
        </div>
      )}
    </div>
  );
}
