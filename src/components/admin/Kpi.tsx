import { cn } from "@/lib/cn";

export function Kpi({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={cn("grid gap-1 rounded-[var(--radius-card)] border bg-paper p-4", alert ? "border-warn bg-warn-soft" : "border-line")}>
      <span className="eyebrow">{label}</span>
      <b className="num text-2xl">{value}</b>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </div>
  );
}
