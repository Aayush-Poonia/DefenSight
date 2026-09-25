import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Loader2, type LucideIcon } from "lucide-react";

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
  placeholder: string;
  accent?: string;
  acceptFile?: boolean;
  onSearch: (value: string, file?: File | null) => Promise<unknown>;
  renderResult: (result: unknown) => ReactNode;
};

export function IntelToolCard({
  title,
  description,
  icon: Icon,
  placeholder,
  accent = "text-primary",
  acceptFile,
  onSearch,
  renderResult,
}: Props) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const run = async () => {
    if (acceptFile && !file) {
      toast.error("Select a file to scan.");
      return;
    }
    if (!acceptFile && !value.trim()) {
      toast.error("Enter a value to analyze.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await onSearch(value.trim(), file);
      setResult(data);
      toast.success(`${title} complete`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lookup failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      toast.success("Result copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Card className="p-5 border-border/70 bg-card/80 backdrop-blur-sm flex flex-col gap-4 min-h-[320px]">
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg bg-muted/60 grid place-items-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {acceptFile ? (
          <Input
            type="file"
            className="h-11 file:mr-3"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && run()}
            placeholder={placeholder}
            className="h-11 font-mono text-sm"
          />
        )}
        <Button onClick={run} disabled={loading} className="h-11 shrink-0 min-w-[110px]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {loading && (
        <div className="rounded-lg border border-dashed border-border/80 p-6 flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span className="text-sm">Querying intelligence providers…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result != null && !loading && (
        <div className="space-y-3 flex-1">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Result
            </Badge>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
              Copy Result
            </Button>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm space-y-2 max-h-[360px] overflow-auto">
            {renderResult(result)}
          </div>
        </div>
      )}
    </Card>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 py-1 border-b border-border/40 last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm break-all font-medium">{value}</div>
    </div>
  );
}

export function BoolBadge({
  value,
  trueLabel = "Yes",
  falseLabel = "No",
  invertColors = false,
}: {
  value: boolean | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
  /** When true, `true` is treated as a good/safe signal (green). */
  invertColors?: boolean;
}) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const good = invertColors ? value : !value;
  return (
    <Badge
      variant="outline"
      className={good ? "border-emerald-500/40 text-emerald-400" : "border-destructive/40 text-destructive"}
    >
      {value ? trueLabel : falseLabel}
    </Badge>
  );
}
