import type { LucideIcon } from "lucide-react";

export type HeroStat = { value: string; label: string };

export function PageHero({
  title,
  subtitle,
  icon: Icon,
  stats = [],
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  stats?: HeroStat[];
}) {
  return (
    <section className="hero-panel px-6 py-7">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-xl border border-border bg-card text-primary shadow-card">
            <Icon className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {stats.length ? (
          <div className="flex items-center">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={
                  i === stats.length - 1
                    ? "px-6 text-center"
                    : "border-s border-border/70 px-6 text-center"
                }
              >
                <div className="text-lg font-bold text-foreground">{stat.value}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
