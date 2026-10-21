import { cn } from "@/lib/cn";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus, type StatusTone } from "@/lib/types";

const tones: Record<StatusTone | "neutral", string> = {
  neutral: "bg-mint-100 text-ink-2",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-mint-200 text-forest-900",
  yolk: "bg-yolk-soft text-yolk-ink",
};

export function Pill({ tone = "neutral", children, className }: { tone?: StatusTone | "neutral"; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}
