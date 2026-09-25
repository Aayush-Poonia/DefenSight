import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

type Props = {
  badge?: string;
  title: string;
  highlight?: string;
  description: string;
  icon?: LucideIcon;
  actions?: ReactNode;
};

export function PageHeader({ badge, title, highlight, description, icon: Icon, actions }: Props) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 shadow-[var(--shadow-card)] animate-in fade-in duration-300">
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none defensight-shimmer-bg"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 28px)",
        }}
      />
      <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="max-w-2xl">
          {badge && (
            <Badge variant="outline" className="mb-3 bg-accent/10 text-accent border-accent/20 font-medium">
              {badge}
            </Badge>
          )}
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5"
            style={{ fontFamily: "Georgia, 'Playfair Display', serif" }}
          >
            {Icon && <Icon className="h-7 w-7 text-accent shrink-0 animate-subtle-float" />}
            <span>
              {title}
              {highlight && <span className="italic text-accent"> {highlight}</span>}
            </span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base leading-relaxed">{description}</p>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </section>
  );
}

export function PremiumCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[var(--shadow-card)] hover-card-rise ${className}`}
    >
      {children}
    </div>
  );
}
