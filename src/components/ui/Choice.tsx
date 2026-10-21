import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ChoiceProps = {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  title: ReactNode;
  sub?: ReactNode;
  className?: string;
};

/** Radio rendered as a selectable card. */
export function Choice({ name, value, checked, disabled, onChange, title, sub, className }: ChoiceProps) {
  return (
    <label className={cn("relative", className)}>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} className="peer sr-only" />
      <span
        className={cn(
          "grid h-full cursor-pointer gap-0.5 rounded-lg border border-line bg-paper px-3.5 py-2.5 transition",
          "peer-checked:border-forest-900 peer-checked:bg-mint-100 peer-checked:shadow-[inset_0_0_0_1px_var(--color-forest-900)]",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-yolk",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-45",
        )}
      >
        <span className="text-sm font-semibold">{title}</span>
        {sub && <span className="text-xs text-ink-3">{sub}</span>}
      </span>
    </label>
  );
}
