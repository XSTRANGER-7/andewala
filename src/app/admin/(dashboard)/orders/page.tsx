import { paymentLabel } from "@/lib/payment";
import { OrderFilters } from "@/components/admin/OrderFilters";
import { OrderRowActions } from "@/components/admin/OrderRowActions";
import { Note } from "@/components/ui/Note";
import { StatusPill } from "@/components/ui/Pill";
import { inr } from "@/lib/money";
import { fmtDay, fmtWhen, nowIst } from "@/lib/time";
import type { OrderView } from "@/lib/types";
import { listOrdersForAdmin, type AdminOrderFilter } from "@/server/orders";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ date?: string; status?: string }> };

const DATE_KEYS: AdminOrderFilter["date"][] = ["today", "tomorrow", "upcoming", "all"];
const STATUS_KEYS: AdminOrderFilter["status"][] = ["active", "issues", "delivered", "cancelled", "all"];

export default async function AdminOrdersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter: AdminOrderFilter = {
    date: DATE_KEYS.includes(sp.date as AdminOrderFilter["date"]) ? (sp.date as AdminOrderFilter["date"]) : "today",
    status: STATUS_KEYS.includes(sp.status as AdminOrderFilter["status"]) ? (sp.status as AdminOrderFilter["status"]) : "active",
  };
  const today = nowIst().date;
  const orders = await listOrdersForAdmin(filter, today);
  const trays = orders.reduce((a, o) => a + o.trays, 0);

  return (
    <div className="grid gap-4">
      <OrderFilters filter={filter} count={orders.length} trays={trays} />
      {orders.length === 0 ? (
        <div className="card text-center">
          <h2 className="font-display text-lg font-bold">No orders here</h2>
          <p className="text-sm text-ink-2">Orders matching these filters will appear as customers place them.</p>
        </div>
      ) : (
        <>
          {/* laptop: table */}
          <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper lg:block">
            <table className="w-full text-sm">
              <thead className="bg-mint-100 text-left text-[11px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Delivery</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5 text-right">Trays</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-line align-top">
                    <td className="px-3 py-3">
                      <b className="num">{o.id}</b>
                      <div className="text-xs text-ink-3">{fmtWhen(o.createdAt)}</div>
                    </td>
                    <td className="px-3 py-3">
                      {o.date === today ? "Today" : fmtDay(o.date)}
                      <div className="text-xs text-ink-3">{o.slotLabel}</div>
                    </td>
                    <td className="min-w-56 px-3 py-3">
                      <CustomerCell o={o} />
                    </td>
                    <td className="num px-3 py-3 text-right">{o.trays}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="num">{inr(o.total)}</span>
                      <div className="text-xs text-ink-3">
                        {paymentLabel(o.payment, o.paymentStatus)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-3 py-3">
                      <OrderRowActions order={o} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* phone: cards */}
          <div className="grid gap-3 lg:hidden">
            {orders.map((o) => (
              <article key={o.id} className="card grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="num">{o.id}</b>
                  <StatusPill status={o.status} />
                </div>
                <div className="flex justify-between text-sm">
                  <span>
                    {o.date === today ? "Today" : fmtDay(o.date)}, {o.slotLabel}
                  </span>
                  <span className="num">
                    {o.trays} tray{o.trays === 1 ? "" : "s"} · {inr(o.total)}
                  </span>
                </div>
                <div className="text-sm">
                  <CustomerCell o={o} />
                </div>
                <div className="text-xs text-ink-3">
                  {paymentLabel(o.payment, o.paymentStatus)} · placed {fmtWhen(o.createdAt)}
                </div>
                <OrderRowActions order={o} />
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomerCell({ o }: { o: OrderView }) {
  return (
    <>
      <b>{o.customer.name}</b> ·{" "}
      <a href={`tel:${o.customer.phone}`} className="num hover:underline">
        {o.customer.phone}
      </a>
      <div className="text-xs text-ink-2">
        {o.customer.address}
        {o.customer.landmark ? `, near ${o.customer.landmark}` : ""} · {o.customer.pincode}
        {o.customer.lat !== null && o.customer.lng !== null && (
          <>
            {" · "}
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.customer.lat},${o.customer.lng}`} target="_blank" rel="noreferrer" className="font-semibold text-forest-900 hover:underline">
              Open pin in Maps
            </a>
          </>
        )}
      </div>
      {o.notes && <div className="text-xs text-ink-3">Note: {o.notes}</div>}
      {o.issue && (
        <Note tone="warn" className="mt-1.5 px-2 py-1 text-xs">
          {o.issue.resolved ? "Resolved: " : "Report: "}
          {o.issue.text}
        </Note>
      )}
    </>
  );
}
