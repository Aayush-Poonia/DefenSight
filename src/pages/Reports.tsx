import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getScans, type LocalScan } from "@/lib/scan-history";
import { ResultActions } from "@/components/threat/ResultActions";
import { riskStyles } from "@/lib/threat-score";
import { Download, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reports() {
  const [scans, setScans] = useState<LocalScan[]>([]);

  useEffect(() => {
    setScans(getScans());
  }, []);

  const exportAllJson = () => {
    const blob = new Blob(
      [JSON.stringify({ exported_at: new Date().toISOString(), scans }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `defensight-reports-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("JSON export ready");
  };

  const exportAllPdf = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("DefenSight AI — Threat Reports", 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
      doc.text(`Total scans: ${scans.length}`, 14, 32);

      autoTable(doc, {
        startY: 38,
        head: [["Type", "Input", "Score", "Risk", "When"]],
        body: scans.slice(0, 60).map((s) => [
          s.type,
          (s.input || "").slice(0, 48),
          s.threat_score != null ? String(s.threat_score) : "—",
          s.risk_level || "—",
          new Date(s.ts).toLocaleString(),
        ]),
        theme: "grid",
        headStyles: { fillColor: [40, 40, 40] },
        styles: { fontSize: 8 },
      });

      doc.save(`defensight-reports-${Date.now()}.pdf`);
      toast.success("PDF export ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
    }
  };

  return (
    <div className="space-y-6">
      <Toaster richColors position="top-center" />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Export any investigation as PDF or JSON
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={exportAllJson} disabled={!scans.length}>
            <FileJson className="h-4 w-4" /> Export all JSON
          </Button>
          <Button className="gap-1.5" onClick={exportAllPdf} disabled={!scans.length}>
            <Download className="h-4 w-4" /> Export all PDF
          </Button>
        </div>
      </div>

      {scans.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          Run analyses first — reports are generated from local scan history.
        </Card>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => {
            const styles = riskStyles(scan.risk_level);
            return (
              <Card key={scan.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{scan.input}</div>
                  <div className="text-xs text-muted-foreground capitalize mt-0.5">
                    {scan.type} · {new Date(scan.ts).toLocaleString()}
                  </div>
                </div>
                <Badge variant="outline" className={`text-xs ${styles.text}`}>
                  {scan.threat_score != null ? `Score ${scan.threat_score}` : "—"}
                </Badge>
                <ResultActions type={scan.type} input={scan.input} result={scan.result} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
