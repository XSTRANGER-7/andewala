"use client";

type StepperProps = { value: number; min: number; max: number; onChange: (n: number) => void; label?: string };

/** − n + quantity control with large touch targets. */
export function Stepper({ value, min, max, onChange, label = "Quantity" }: StepperProps) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-line" role="group" aria-label={label}>
      <button
        type="button"
        className="h-11 w-11 bg-mint-100 text-xl leading-none text-ink transition hover:bg-mint-200 disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="One less"
      >
        −
      </button>
      <output className="num w-14 text-center text-lg font-bold" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className="h-11 w-11 bg-mint-100 text-xl leading-none text-ink transition hover:bg-mint-200 disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="One more"
      >
        +
      </button>
    </div>
  );
}
