import { useState } from "react";
import { intelApi, type FileScanResult } from "@/lib/intel-api";
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
import { FileSearch, Loader2 } from "lucide-react";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function FileScanner() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FileScanResult | null>(null);

  const run = async () => {
    if (!file) {
      toast.error("Select a file to scan");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const r = await intelApi.file({
        filename: file.name,
        contentBase64,
        contentType: file.type || "application/octet-stream",
      });
      setResult(r);
      addScan({
        type: "file",
        input: file.name,
        result: r as unknown as Record<string, unknown>,
        threat_score: r.threat_score,
        risk_level: r.risk_level,
      });
      toast.success("File scan complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Toaster richColors position="top-center" />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileSearch className="h-7 w-7" /> File Scanner
        </h1>
        <p className="text-muted-foreground mt-1">
          Scanii, VirusTotal, Hybrid Analysis, MalwareBazaar, and ThreatFox
        </p>
      </div>

      <Card className="p-4 sm:p-5 flex flex-col sm:flex-row gap-2">
        <Input
          type="file"
          className="h-11 file:mr-3"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button className="h-11 min-w-[120px]" disabled={loading} onClick={run}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
        </Button>
      </Card>

      {loading && (
        <Card className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
          <span className="text-sm">Scanning across threat feeds…</span>
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-[1fr_0.9fr] gap-4">
            <Card className="p-4 sm:p-5 space-y-1">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold">Detection Result</h3>
                <ResultActions
                  type="file"
                  input={String(result.file_information?.filename || "file")}
                  result={result as unknown as Record<string, unknown>}
                  filename={`file-scan-${Date.now()}.json`}
                />
              </div>
              <FieldRow label="Scan Status" value={result.scan_status} />
              <FieldRow
                label="Verdict"
                value={
                  <Badge
                    variant="outline"
                    className={
                      result.safe
                        ? "border-emerald-500/40 text-emerald-500"
                        : "border-destructive/40 text-destructive"
                    }
                  >
                    {result.verdict}
                  </Badge>
                }
              />
              <FieldRow
                label="Detections"
                value={
                  result.detection_results?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {result.detection_results.slice(0, 6).map((d, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-normal">
                          {typeof d === "string"
                            ? d
                            : typeof d === "object" && d && "label" in d
                              ? String((d as { label?: string; source?: string }).source || "") +
                                ": " +
                                String((d as { label?: string }).label || JSON.stringify(d))
                              : JSON.stringify(d)}
                        </Badge>
                      ))}
                      {result.detection_results.length > 6 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{result.detection_results.length - 6} more
                        </Badge>
                      )}
                    </div>
                  ) : (
                    "None"
                  )
                }
              />
              <FieldRow label="File Name" value={String(result.file_information?.filename || "—")} />
              <FieldRow
                label="Content Type"
                value={String(result.file_information?.content_type || "—")}
              />
              <FieldRow
                label="Size"
                value={
                  result.file_information?.content_length != null
                    ? `${result.file_information.content_length} bytes`
                    : "—"
                }
              />
              <FieldRow label="Checksum" value={String(result.file_information?.checksum || "—")} />
            </Card>
            <ThreatScorePanel threat={result.threat} />
          </div>
          <AdvancedDetailsPanel data={result as unknown as Record<string, unknown>} />
        </div>
      )}
    </div>
  );
}
