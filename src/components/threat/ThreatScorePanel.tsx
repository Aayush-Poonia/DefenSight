import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { riskStyles, type ThreatScore } from "@/lib/threat-score";
import { Progress } from "@/components/ui/progress";

export function ThreatScorePanel({ threat }: { threat: ThreatScore | null | undefined }) {
  if (!threat) return null;
  const styles = riskStyles(threat.risk_level);

  return (
    <Card className={`p-4 sm:p-5 ring-1 ${styles.ring} bg-card/80 backdrop-blur-sm shadow-[var(--shadow-card)] border-border/60`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Threat Score</div>
          <div className={`text-4xl font-bold tabular-nums mt-1 ${styles.text}`}>{threat.score}</div>
        </div>
        <Badge variant="outline" className={`${styles.bg} ${styles.text} border-0`}>
          {styles.label}
        </Badge>
      </div>

      <Progress value={threat.score} className="h-2 mb-4" />

      <div className="space-y-2">
        <div className="text-sm font-semibold">Why this score?</div>
        {threat.reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No elevated risk factors from available signals.</p>
        ) : (
          <ul className="space-y-1.5">
            {threat.reasons.map((r) => (
              <li key={r} className="text-sm flex gap-2">
                <span className={styles.text}>✔</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {threat.breakdown.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
          <div className="text-sm font-semibold">Score Breakdown</div>
          {threat.breakdown.map((b) => (
            <div key={b.factor} className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{b.factor}</span>
              <span className={`font-mono ${styles.text}`}>+{b.points}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
