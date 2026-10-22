import { Note } from "@/components/ui/Note";
import { cn } from "@/lib/cn";
import { CUSTOMER_STEPS, customerStatus, STATUS_LABEL, type OrderView } from "@/lib/types";
import { fmtWhen } from "@/lib/time";

/** Customer order tracking: Placed, Out for delivery, Delivered. */
export function OrderTimeline({ order }: { order: OrderView }) {
  if (order.status === "cancelled") {
    const when = order.history.find((h) => h.status === "cancelled")?.at;
    return <Note tone="bad">This order was cancelled{when ? ` on ${fmtWhen(when)}` : ""}.</Note>;
  }
  const current = CUSTOMER_STEPS.indexOf(customerStatus(order.status) as (typeof CUSTOMER_STEPS)[number]);
  return (
    <ol className="grid grid-cols-3 gap-1.5" aria-label="Order progress">
      {CUSTOMER_STEPS.map((s, i) => {
        const done = i <= current;
        const at = order.history.find((h) => h.status === s)?.at;
        return (
          <li key={s} aria-current={i === current ? "step" : undefined} className={cn("grid gap-1.5 text-center text-xs sm:text-sm", done ? "font-semibold text-forest-900" : "text-ink-3")}>
            <span className={cn("h-1.5 rounded-full", done ? "bg-forest-900" : "bg-mint-200")} aria-hidden="true" />
            <span>{STATUS_LABEL[s]}</span>
            {done && at && <span className="text-[11px] font-normal text-ink-3 sm:text-xs">{fmtWhen(at)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
