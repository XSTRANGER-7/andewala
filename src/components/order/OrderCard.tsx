import Link from "next/link";
import { StatusPill } from "@/components/ui/Pill";
import { inr } from "@/lib/money";
import { fmtDay } from "@/lib/time";
import type { OrderView } from "@/lib/types";
import { OrderTimeline } from "./OrderTimeline";
import { paymentLabel } from "@/lib/payment";

export function OrderCard({ order, today }: { order: OrderView; today: string }) {
  return (
    <article className="card grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/order/${order.id}`} className="num font-bold hover:underline">
            {order.id}
          </Link>
          <StatusPill status={order.status} customer />
        </div>
        <b className="num">{inr(order.total)}</b>
      </div>
      <p className="text-sm text-ink-2">
        {order.trays} tray{order.trays > 1 ? "s" : ""} · {order.date === today ? "Today" : fmtDay(order.date)}, {order.slotLabel} · {paymentLabel(order.payment, order.paymentStatus)}
      </p>
      <OrderTimeline order={order} />
      <div>
        <Link href={`/order/${order.id}`} className="text-sm font-semibold text-forest-900 hover:underline">
          View details →
        </Link>
      </div>
    </article>
  );
}
