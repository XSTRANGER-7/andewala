import Link from "next/link";
import { Kpi } from "@/components/admin/Kpi";
import { Note } from "@/components/ui/Note";
import { StatusPill } from "@/components/ui/Pill";
import { inr } from "@/lib/money";
import { effectivePrice, fullCost } from "@/lib/pricing";
import { availableTrays, reservedTrays } from "@/lib/availability";
import { fmtDay, fmtTime, nowIst } from "@/lib/time";
import { ACTIVE_STATUSES } from "@/lib/types";
import { getSettings } from "@/server/settings";
import { getBookings, listRecentOrders } from "@/server/orders";
import { dayStats, trailingDays } from "@/server/reports";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const now = nowIst();
  const [settings, bookings, orders] = await Promise.all([getSettings(), getBookings(undefined, now.date), listRecentOrders(7, now.date)]);
  const available = availableTrays(settings, bookings);
  const reserved = reservedTrays(bookings);
  const ep = effectivePrice(settings, now.date);
  const cost = fullCost(settings.costs);
  const today = dayStats(orders, now.date);
  const week = trailingDays(orders, now.date, 7);
  const maxRevenue = Math.max(1, ...week.map((d) => d.revenue));
  const issues = orders.filter((o) => o.issue && !o.issue.resolved);
  const bySlot = settings.slots.map((slot) => ({ slot, orders: today.orders.filter((o) => o.slotId === slot.id && ACTIVE_STATUSES.includes(o.status)) }));

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        {ep.price < cost && (
          <Note tone="bad">
            Today&apos;s price {inr(ep.price)} is below your cost of {inr(cost)} per tray. Every order loses money.
          </Note>
        )}
        {available <= 5 && (
          <Note tone="warn">
            Only {available} tray{available === 1 ? "" : "s"} left to sell.{" "}
            <Link href="/admin/pricing" className="font-semibold underline">
              Add a farm purchase
            </Link>
            .
          </Note>
        )}
        {issues.length > 0 && (
          <Note tone="warn">
            {issues.length} customer report{issues.length > 1 ? "s" : ""} waiting.{" "}
            <Link href="/admin/orders?status=issues&date=all" className="font-semibold underline">
              Open reports
            </Link>
            .
          </Note>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Price today" value={inr(ep.price)} sub={`cost ${inr(cost)}`} />
        <Kpi label="Trays to sell" value={String(available)} sub={`${settings.stock} on hand · ${reserved} reserved`} alert={available <= 5} />
        <Kpi label="Orders today" value={String(today.orders.length)} sub={`${today.trays} trays`} />
        <Kpi label="Pending deliveries" value={String(today.pending)} sub={`by ${fmtTime(settings.deadline)}`} />
        <Kpi label="Revenue today" value={inr(today.revenue)} sub={`contribution ${inr(today.contribution)}`} />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="card grid min-w-0 content-start gap-4 overflow-hidden">
          <h2 className="font-display text-lg font-bold">Packing list for today</h2>
          {bySlot.map(({ slot, orders: os }) => (
            <div key={slot.id} className="grid min-w-0 gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <b>{slot.label}</b>
                <span className="num text-xs text-ink-3">
                  {os.reduce((a, o) => a + o.trays, 0)} trays · {os.length}/{slot.capacity} orders
                </span>
              </div>
              {os.length ? (
                os.map((o) => (
                  <div key={o.id} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {o.customer.name} <span className="text-ink-3">· {o.customer.address}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="num">{o.trays} ×</span>
                      <StatusPill status={o.status} />
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-sm text-ink-3">No orders in this window.</span>
              )}
            </div>
          ))}
        </section>

        <section className="card grid min-w-0 content-start gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">Last 7 days</h2>
            <span className="text-xs text-ink-3">revenue per day</span>
          </div>
          <div className="grid h-44 grid-cols-7 items-end gap-2 pt-2">
            {week.map((d) => (
              <div key={d.date} className="grid h-full content-end justify-items-center gap-1 text-[11px] text-ink-3" title={`${fmtDay(d.date)}: ${inr(d.revenue)}, ${d.trays} trays`}>
                <b className="num text-ink-2">{d.revenue ? Math.round(d.revenue / 100) / 10 + "k" : ""}</b>
                <i className={`block w-full max-w-11 rounded-t-md ${d.date === now.date ? "bg-yolk" : "bg-forest-900"}`} style={{ height: `${Math.max(2, Math.round((d.revenue / maxRevenue) * 120))}px` }} />
                <span>{fmtDay(d.date).split(",")[0]}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-3">
            7-day total {inr(week.reduce((a, d) => a + d.revenue, 0))} · contribution {inr(week.reduce((a, d) => a + d.contribution, 0))} · {week.reduce((a, d) => a + d.trays, 0)} trays
          </p>
        </section>
      </div>
    </div>
  );
}
