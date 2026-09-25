import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { intelApi, type PhoneIntelResult } from "@/lib/intel-api";
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
import { Loader2, Phone } from "lucide-react";

export default function PhoneIntelligence() {
  const [params] = useSearchParams();
  const [phone, setPhone] = useState(params.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhoneIntelResult | null>(null);

  const run = async (value = phone) => {
    if (!value.trim()) {
      toast.error("Enter a phone number");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await intelApi.phone(value.trim());
      setResult(r);
      addScan({
        type: "phone",
        input: value.trim(),
        result: r as unknown as Record<string, unknown>,
        threat_score: r.threat_score,
        risk_level: r.risk_level,
      });
      toast.success("Phone analysis complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q) {
      setPhone(q);
      run(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Toaster richColors position="top-center" />

      <div>
        <Badge variant="outline" className="mb-2">
          Intel Hub
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Phone className="h-7 w-7" /> Phone Intelligence
        </h1>
        <p className="text-muted-foreground mt-1">
          Numverify + Abstract Phone — carrier, line type, and validation
        </p>
      </div>

      <Card className="p-4 sm:p-5 flex flex-col sm:flex-row gap-2">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && run()}
          placeholder="+1 (415) 858-6273 or 14158586273"
          className="h-11 font-mono"
        />
        <Button className="h-11 min-w-[120px]" disabled={loading} onClick={() => run()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
        </Button>
      </Card>

      {loading && (
        <Card className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
          <span className="text-sm">Querying Numverify & Abstract Phone…</span>
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <Card className="p-4 sm:p-5 space-y-1">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold">Phone Report</h3>
                <ResultActions
                  type="phone"
                  input={result.phone}
                  result={result as unknown as Record<string, unknown>}
                />
              </div>
              <FieldRow
                label="Valid Number"
                value={result.valid == null ? "—" : result.valid ? "Valid" : "Invalid"}
              />
              <FieldRow label="Carrier" value={result.carrier} />
              <FieldRow label="Country" value={result.country} />
              <FieldRow label="Region" value={result.region} />
              <FieldRow label="Line Type" value={result.line_type} />
              <FieldRow label="International" value={result.international_format} />
              <FieldRow label="Local" value={result.local_format} />
              <FieldRow label="Validation Score" value={result.validation_score} />
              <p className="text-xs text-muted-foreground pt-3 border-t border-border/40 mt-2">
                These providers validate format, carrier, and line type. They do not indicate whether a
                number belongs to a scammer.
              </p>
            </Card>
            <ThreatScorePanel threat={result.threat} />
          </div>
          <AdvancedDetailsPanel data={result as unknown as Record<string, unknown>} />
        </div>
      )}
    </div>
  );
}
