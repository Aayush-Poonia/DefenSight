import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ChevronDown, Copy, Database, Layers } from "lucide-react";

export type DetailSection = {
  title: string;
  rows?: Array<{ label: string; value: React.ReactNode }>;
  content?: React.ReactNode;
};

type Props = {
  data: Record<string, unknown>;
  sections?: DetailSection[];
  defaultOpen?: boolean;
};

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "string")) return v.join(", ") || "—";
    return JSON.stringify(v, null, 2);
  }
  return JSON.stringify(v, null, 2);
}

function flattenObject(obj: Record<string, unknown>, prefix = ""): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const label = prefix ? `${prefix}.${k}` : k;
    if (v == null) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      rows.push(...flattenObject(v as Record<string, unknown>, label));
    } else {
      rows.push({ label, value: formatValue(v) });
    }
  }
  return rows;
}

function buildProviderSections(data: Record<string, unknown>): DetailSection[] {
  const out: DetailSection[] = [];
  const sources = data.sources as Record<string, { ok?: boolean; error?: string }> | undefined;
  const providerErrors = data.provider_errors as Record<string, string | null> | undefined;

  if (sources && typeof sources === "object") {
    out.push({
      title: "Provider Status",
      rows: Object.entries(sources).map(([name, st]) => {
        const isApiKeyErr = st?.error?.includes("API key") || st?.error?.includes("unconfigured") || st?.error?.includes("Server missing");
        return {
          label: name.replace(/_/g, " "),
          value: st?.ok ? (
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/5">
              OK
            </Badge>
          ) : isApiKeyErr ? (
            <Badge variant="outline" className="text-[10px] border-accent/40 text-accent bg-accent/5">
              Local Heuristics
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs font-mono">{st?.error || "Offline"}</span>
          ),
        };
      }),
    });
  }

  if (providerErrors && typeof providerErrors === "object") {
    const rows = Object.entries(providerErrors)
      .filter(([, err]) => err)
      .map(([name, err]) => {
        const cleanErr = (err?.includes("API key") || err?.includes("Server missing") || err?.includes("unconfigured"))
          ? "Local heuristics engine active"
          : err;
        return { label: name.replace(/_/g, " "), value: cleanErr };
      });
    if (rows.length) out.push({ title: "Provider Status & Notes", rows });
  }

  return out;
}

function buildAutoSections(data: Record<string, unknown>): DetailSection[] {
  const keys = ["intel", "summary", "extras", "number_info", "phishstats", "urlscan", "file_information", "mx_records"];
  const sections: DetailSection[] = [];

  for (const key of keys) {
    const val = data[key];
    if (!val || typeof val !== "object") continue;
    sections.push({
      title: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      rows: flattenObject(val as Record<string, unknown>).map((r) => ({
        label: r.label.split(".").pop() || r.label,
        value: r.value,
      })),
    });
  }

  if (Array.isArray(data.detection_results) && data.detection_results.length) {
    sections.push({
      title: "Detection Results (Full)",
      content: (
        <ul className="space-y-2 text-sm">
          {data.detection_results.map((item, i) => (
            <li key={i} className="p-2 rounded-md bg-muted/40 border border-border/40 font-mono text-xs break-all">
              {typeof item === "string" ? item : JSON.stringify(item, null, 2)}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (data.threat && typeof data.threat === "object") {
    const threat = data.threat as { breakdown?: Array<{ factor: string; points: number }> };
    if (threat.breakdown?.length) {
      sections.push({
        title: "Threat Score Breakdown",
        rows: threat.breakdown.map((b) => ({
          label: b.factor,
          value: `+${b.points} pts`,
        })),
      });
    }
  }

  return sections;
}

export function AdvancedDetailsPanel({ data, sections = [], defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const allSections = [...buildProviderSections(data), ...sections, ...buildAutoSections(data)];

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.success("Advanced data copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden border-border/60">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              <span className="font-semibold text-sm">Advanced Details</span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {allSections.length} section{allSections.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/60 px-4 sm:px-5 py-4 space-y-5">
            {allSections.map((section) => (
              <div key={section.title}>
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </h4>
                </div>
                {section.content ? (
                  section.content
                ) : (
                  <div className="rounded-md border border-border/40 divide-y divide-border/40">
                    {(section.rows || []).map((row) => (
                      <div
                        key={`${section.title}-${row.label}`}
                        className="grid grid-cols-[minmax(120px,35%)_1fr] gap-2 px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground text-xs capitalize">{row.label}</span>
                        <span className="break-all font-mono text-xs">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Full Response JSON
                </h4>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={copyJson}>
                  <Copy className="h-3 w-3" /> Copy JSON
                </Button>
              </div>
              <ScrollArea className="h-[280px] rounded-md border border-border/60 bg-muted/30">
                <pre className="p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
