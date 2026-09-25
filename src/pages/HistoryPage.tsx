import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  deleteScan,
  getScans,
  modulePath,
  type LocalScan,
  type ScanType,
} from "@/lib/scan-history";
import { riskStyles } from "@/lib/threat-score";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { History as HistoryIcon, RotateCcw, Search, Trash2 } from "lucide-react";

const TYPES: Array<ScanType | "all"> = [
  "all",
  "ip",
  "phone",
  "email",
  "email_ai",
  "phishing",
  "file",
  "news",
  "password",
];

export default function HistoryPage() {
  const [scans, setScans] = useState<LocalScan[]>([]);
  const [filter, setFilter] = useState<ScanType | "all">("all");
  const [q, setQ] = useState("");

  const refresh = () => setScans(getScans());

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    return scans.filter((s) => {
      if (filter !== "all" && s.type !== filter) return false;
      if (q.trim() && !s.input.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [scans, filter, q]);

  const handleDelete = (id: string) => {
    deleteScan(id);
    refresh();
    toast.success("Scan deleted");
  };

  return (
    <div className="space-y-6">
      <Toaster richColors position="top-center" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan History</h1>
        <p className="text-muted-foreground mt-1">
          Local history of previous investigations — search, delete, or re-run
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by input…"
              className="pl-9 h-10"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={filter === t ? "default" : "outline"}
              className="h-8 capitalize"
              onClick={() => setFilter(t)}
            >
              {t}
            </Button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <HistoryIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No matching scans in local history.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((scan) => {
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
                  {scan.threat_score != null ? `Score ${scan.threat_score}` : scan.risk_level || "done"}
                </Badge>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
                    <Link to={`${modulePath(scan.type)}?q=${encodeURIComponent(scan.input)}`}>
                      <RotateCcw className="h-3.5 w-3.5" /> Re-run
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive"
                    onClick={() => handleDelete(scan.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
