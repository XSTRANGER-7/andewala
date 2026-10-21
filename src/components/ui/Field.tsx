import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

/** Label + control + hint/error, laid out consistently. */
export function Field({ label, htmlFor, hint, error, optional, className, children }: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-3">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}
