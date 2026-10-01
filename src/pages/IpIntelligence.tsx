import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { intelApi, type IpIntelResult } from "@/lib/intel-api";
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
import { Loader2, Network } from "lucide-react";

export default function IpIntelligence() {
  const [params] = useSearchParams();
  const [ip, setIp] = useState(params.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IpIntelResult | null>(null);

  const run = async (value = ip) => {
    if (!value.trim()) {
      toast.error("Enter an IP address");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await intelApi.ip(value.trim());
      setResult(r);
      addScan({
        type: "ip",
        input: value.trim(),
        result: r as unknown as Record<string, unknown>,
        threat_score: r.threat_score,
        risk_level: r.risk_level,
      });
      toast.success("IP analysis complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q) {
      setIp(q);
      run(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <Toaster richColors position="top-center" />

      {/* Header section with grid background */}
      <section className="relative overflow-hidden border-b border-border/40 mb-6">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 32px)" }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8">
          <div className="max-w-3xl">
            <Badge className="mb-5 bg-accent/10 text-accent border-accent/20" variant="outline">Intel Hub</Badge>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]" style={{ fontFamily: "Georgia, 'Playfair Display', serif" }}>
              IP <span className="italic text-accent">Intelligence</span>.
            </h1>
            <p className="mt-4 text-base text-muted-foreground max-w-2xl leading-relaxed">
              Query MaxMind GeoIP, Censys, IPinfo, Abstract, VirusTotal, AbuseIPDB, AlienVault OTX, and ThreatFox to construct a unified routing, reputation, and threat profile.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 pb-12">
        <Card className="p-4 sm:p-5 flex flex-col sm:flex-row gap-2 border-border/60 shadow-[var(--shadow-elegant)]">
          <Input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && run()}
            placeholder="8.8.8.8"
            className="h-11 font-mono text-sm"
          />
          <Button className="h-11 min-w-[120px] bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading} onClick={() => run()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
          </Button>
        </Card>

      {loading && (
        <Card className="p-8 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <Card className="p-4 sm:p-5 space-y-1">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold">IP Report</h3>
                <ResultActions type="ip" input={result.ip} result={result as unknown as Record<string, unknown>} />
              </div>
              <FieldRow label="IP Address" value={result.ip} />
              <FieldRow label="Country" value={result.country} />
              <FieldRow label="Region" value={result.region} />
              <FieldRow label="ASN" value={result.asn} />
              <FieldRow label="Organization" value={result.organization} />
              <FieldRow label="ISP" value={result.isp} />
              <FieldRow label="Hosting" value={result.hosting_provider || "—"} />
              <FieldRow label="IP Type" value={result.ip_type} />
              <FieldRow
                label="Security"
                value={
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.security || {}).map(([k, v]) => (
                      <Badge
                        key={k}
                        variant="outline"
                        className={`text-[10px] ${v ? "border-destructive/40 text-destructive" : "opacity-60"}`}
                      >
                        {k.replace(/^is_/, "")}: {v ? "yes" : "no"}
                      </Badge>
                    ))}
                  </div>
                }
              />
            </Card>
            <ThreatScorePanel threat={result.threat} />
          </div>
          <AdvancedDetailsPanel data={result as unknown as Record<string, unknown>} />
        </div>
      )}
      </section>
    </div>
  );
}
