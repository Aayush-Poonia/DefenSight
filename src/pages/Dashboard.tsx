import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  detectQueryType,
  getScans,
  mostUsedModule,
  modulePath,
  type LocalScan,
} from "@/lib/scan-history";
import { riskStyles } from "@/lib/threat-score";
import {
  AlertTriangle,
  BarChart3,
  FileSearch,
  Globe,
  Mail,
  Network,
  Phone,
  Radar,
  ScanSearch,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

const QUICK = [
  { to: "/intel/ip", label: "IP Intel", icon: Network },
  { to: "/intel/phone", label: "Phone", icon: Phone },
  { to: "/intel/file", label: "File Scan", icon: FileSearch },
  { to: "/phishing", label: "PhishGuard", icon: Globe },
  { to: "/email", label: "Email", icon: Mail },
  { to: "/news", label: "News", icon: ScanSearch },
  { to: "/vulnerability", label: "Vuln Intel", icon: ShieldAlert },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [scans, setScans] = useState<LocalScan[]>([]);

  useEffect(() => {
    setScans(getScans());
  }, []);

  const stats = useMemo(() => {
    const high = scans.filter((s) => s.risk_level === "high" || (s.threat_score ?? 0) >= 71).length;
    const medium = scans.filter((s) => s.risk_level === "medium" || ((s.threat_score ?? 0) >= 31 && (s.threat_score ?? 0) < 71)).length;
    const phishing = scans.filter((s) => s.type === "phishing").length;
    return { total: scans.length, high, medium, phishing };
  }, [scans]);

  const used = mostUsedModule(scans);

  const pieData = [
    { name: "High", value: stats.high, color: "oklch(0.62 0.22 27)" },
    { name: "Medium", value: stats.medium, color: "oklch(0.75 0.15 85)" },
    {
      name: "Low",
      value: Math.max(0, stats.total - stats.high - stats.medium),
      color: "oklch(0.55 0.15 150)",
    },
  ].filter((d) => d.value > 0);

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of scans) map.set(s.type, (map.get(s.type) || 0) + 1);
    return [...map.entries()].map(([name, count]) => ({ name, count }));
  }, [scans]);

  const onSearch = () => {
    const detected = detectQueryType(query);
    if (!detected) {
      toast.error("Could not detect IP, URL, domain, email, or phone");
      return;
    }
    toast.message(`Detected ${detected.type}`, { description: `Opening ${detected.path}` });
    navigate(detected.path);
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <Toaster richColors position="top-center" />

      {/* Header section with grid background */}
      <section className="relative overflow-hidden border-b border-border/40 mb-6">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 32px)" }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8">
          <div className="max-w-3xl">
            <Badge className="mb-5 bg-accent/10 text-accent border-accent/20" variant="outline">Overview</Badge>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]" style={{ fontFamily: "Georgia, 'Playfair Display', serif" }}>
              Threat <span className="italic text-accent">Dashboard</span>.
            </h1>
            <p className="mt-4 text-base text-muted-foreground max-w-2xl leading-relaxed">
              Overview of your security analyses, recent indicators, and historical scanning metrics.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 pb-12">
        <Card className="p-4 sm:p-5 shadow-[var(--shadow-elegant)] border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-accent" />
            <h3 className="font-semibold text-xs font-mono uppercase tracking-widest text-muted-foreground">Global Search</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Paste an IP, URL, domain, email, or phone…"
              className="h-11 font-mono text-sm"
            />
            <Button className="h-11 min-w-[120px] bg-accent text-accent-foreground hover:bg-accent/90" onClick={onSearch}>
              Investigate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Auto-detects the indicator type and routes you to the correct module.
          </p>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BarChart3} label="Total Scans" value={stats.total} />
          <StatCard icon={Globe} label="URL Investigations" value={stats.phishing} color="text-chart-1" />
          <StatCard icon={AlertTriangle} label="High Risk Scans" value={stats.high} color="text-destructive" />
          <StatCard icon={Radar} label="Most Active Module" value={used ? used : "—"} color="text-accent" />
        </div>

        <Card className="p-5 border-border/60">
          <h3 className="font-semibold mb-3 text-sm" style={{ fontFamily: "Georgia, serif" }}>Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {QUICK.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-accent/40 transition-all p-3 text-center"
              >
                <t.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <div className="text-xs font-semibold">{t.label}</div>
              </Link>
            ))}
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-5 border-border/60">
            <h3 className="font-semibold mb-4 text-sm" style={{ fontFamily: "Georgia, serif" }}>Threat Distribution</h3>
            {pieData.length > 0 ? (
              <ChartContainer
                config={{
                  high: { label: "High", color: "oklch(0.62 0.22 27)" },
                  medium: { label: "Medium", color: "oklch(0.75 0.15 85)" },
                  low: { label: "Low", color: "oklch(0.55 0.15 150)" },
                }}
                className="h-[250px]"
              >
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-xs font-mono">
                No scan history details available yet
              </div>
            )}
          </Card>

          <Card className="p-5 border-border/60">
            <h3 className="font-semibold mb-4 text-sm" style={{ fontFamily: "Georgia, serif" }}>Module Activity</h3>
            <ChartContainer
              config={{ count: { label: "Scans", color: "oklch(0.55 0.15 150)" } }}
              className="h-[250px]"
            >
              <BarChart data={typeCounts.length ? typeCounts : [{ name: "none", count: 0 }]}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <ChartTooltip content={<ChartTooltipContent />} />
              </BarChart>
            </ChartContainer>
          </Card>
        </div>

        <Card className="p-5 border-border/60">
          <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
            <h3 className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif" }}>Recent Investigations</h3>
            <Link to="/history" className="text-xs text-accent hover:underline">
              Full history →
            </Link>
          </div>
          {scans.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No scans yet. Use Global Search or Quick Actions to start.
            </p>
          ) : (
            <div className="space-y-2">
              {scans.slice(0, 8).map((scan) => {
                const styles = riskStyles(scan.risk_level);
                return (
                  <Link
                    key={scan.id}
                    to={`${modulePath(scan.type)}?q=${encodeURIComponent(scan.input)}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 border border-border/40 hover:border-accent/30 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate font-mono">{scan.input}</div>
                      <div className="text-xs text-muted-foreground capitalize mt-0.5">
                        {scan.type.replace(/_/g, " ")} · {new Date(scan.ts).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs ${styles.text}`}>
                      {scan.threat_score != null ? `Score ${scan.threat_score}` : scan.risk_level || "completed"}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <Card className="p-4 border-border/60 bg-card/50 backdrop-blur hover-card-rise transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted/40 ${color || "text-primary"} transition-transform duration-200 hover:scale-110`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xl font-bold truncate" style={{ fontFamily: "Georgia, serif" }}>{value}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}
