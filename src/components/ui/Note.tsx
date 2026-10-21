import { cn } from "@/lib/cn";

const tones = {
  info: "bg-mint-100 text-forest-900",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

export function Note({ tone = "info", children, className }: { tone?: keyof typeof tones; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg px-3.5 py-2.5 text-sm", tones[tone], className)} role={tone === "bad" ? "alert" : undefined}>
      {children}
    </div>
  );
}
