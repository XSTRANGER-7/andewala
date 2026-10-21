import { cn } from "@/lib/cn";

/** A 5×6 egg tray; `filled` controls how many eggs are drawn. */
export function EggTray({ filled = 30, className }: { filled?: number; className?: string }) {
  const eggs = [];
  for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 6; k++) {
      const i = r * 6 + k;
      eggs.push(
        <ellipse
          key={i}
          cx={18 + k * 28}
          cy={18 + r * 28}
          rx="10.5"
          ry="12"
          fill={i < filled ? "var(--color-shell)" : "var(--color-mint-100)"}
          stroke="var(--color-shell-edge)"
          strokeWidth="1.2"
        />,
      );
    }
  }
  return (
    <svg className={cn("block", className)} viewBox="0 0 176 148" aria-hidden="true">
      <rect x="2" y="2" width="172" height="144" rx="14" fill="var(--color-mint-50)" stroke="var(--color-shell-edge)" strokeWidth="2" />
      {eggs}
    </svg>
  );
}
