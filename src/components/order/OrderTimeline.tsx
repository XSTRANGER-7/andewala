import { Note } from "@/components/ui/Note";
import { cn } from "@/lib/cn";
import { ORDER_FLOW, STATUS_LABEL, type OrderView } from "@/lib/types";
import { fmtWhen } from "@/lib/time";

export function OrderTimeline({ order }: { order: OrderView }) {
  if (order.status === "cancelled") {
    const when = order.history.find((h) => h.status === "cancelled")?.at;
    return <Note tone="bad">This order was cancelled{when ? ` on ${fmtWhen(when)}` : ""}.</Note>;
  }
  const current = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {ORDER_FLOW.map((s, i) => {
        const done = i <= current;
        const at = order.history.find((h) => h.status === s)?.at;
        return (
          <li key={s} className={cn("grid gap-1.5 text-center text-[11px] sm:text-xs", done ? "font-semibold text-forest-900" : "text-ink-3")}>
            <span className={cn("h-1.5 rounded-full", done ? "bg-forest-900" : "bg-mint-200")} aria-hidden="true" />
            <span>{STATUS_LABEL[s]}</span>
            {done && at && <span className="hidden font-normal text-ink-3 sm:block">{fmtWhen(at)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
