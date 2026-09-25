import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Download, FileJson } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ScanType } from "@/lib/scan-history";

export type ScanTypeOrAi = ScanType | "email_ai";

export function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 py-1.5 border-b border-border/40 last:border-0">
      <div className="text-xs text-muted-foreground pt-0.5">{label}</div>
      <div className="text-sm break-all font-medium">{value}</div>
    </div>
  );
}

type Props = {
  type: ScanTypeOrAi;
  input: string;
  result: Record<string, unknown>;
  filename?: string;
};

export function ResultActions({ type, input, result, filename }: Props) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      toast.success("Result copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ type, input, result, exported_at: new Date().toISOString() }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || `${type}-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("JSON downloaded");
  };

  const downloadPdf = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("DefenSight AI — Investigation Report", 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Module: ${type}`, 14, 26);
      doc.text(`Input: ${input.slice(0, 90)}`, 14, 32);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);

      const rows = Object.entries(flattenForPdf(result)).slice(0, 40);
      autoTable(doc, {
        startY: 44,
        head: [["Field", "Value"]],
        body: rows.map(([k, v]) => [k, v]),
        theme: "grid",
        headStyles: { fillColor: [40, 40, 40] },
        styles: { fontSize: 8, cellWidth: "wrap" },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 130 } },
      });

      doc.save(filename?.replace(/\.json$/, ".pdf") || `${type}-report-${Date.now()}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={copy}>
        <Copy className="h-3.5 w-3.5" /> Copy Result
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={downloadJson}>
        <FileJson className="h-3.5 w-3.5" /> JSON
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={downloadPdf}>
        <Download className="h-3.5 w-3.5" /> PDF
      </Button>
    </div>
  );
}

function flattenForPdf(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "sources" || k === "raw") continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (v == null) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flattenForPdf(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      out[key] = v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("; ").slice(0, 200);
    } else {
      out[key] = String(v).slice(0, 200);
    }
  }
  return out;
}
