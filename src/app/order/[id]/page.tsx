import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EggTray } from "@/components/art/EggTray";
import { SiteShell } from "@/components/layout/SiteShell";
import { FindOrderForm } from "@/components/order/FindOrderForm";
import { OrderActions } from "@/components/order/OrderActions";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { AddToCart } from "@/components/cart/AddToCart";
import { Note } from "@/components/ui/Note";
import { StatusPill } from "@/components/ui/Pill";
import { inr } from "@/lib/money";
import { paymentLabel } from "@/lib/payment";
import { fmtDay, fmtWhen, nowIst } from "@/lib/time";
import { getOrder } from "@/server/orders";
import { getCustomerId } from "@/server/session";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; phone?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id.toUpperCase()}`, robots: { index: false } };
}

export default async function OrderDetailPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const order = await getOrder(id);
  if (!order) notFound();

  const cid = await getCustomerId();
  const owned = !!cid && order.customerId === cid;
  const phone = sp.phone?.replace(/\D/g, "").slice(-10);
  const verified = owned || (!!phone && phone === order.customer.phone);
  const today = nowIst().date;

  if (!verified) {
    return (
      <SiteShell>
        <div className="container-x grid max-w-2xl gap-6 py-10">
          <header className="grid gap-1">
            <p className="eyebrow">Track order</p>
            <h1 className="font-display text-3xl font-bold">Confirm it&apos;s your order</h1>
            <p className="text-sm text-ink-2">Enter the mobile number used for order {order.id} to see its status.</p>
          </header>
          <div className="card">
            <FindOrderForm initialId={order.id} />
          </div>
        </div>
      </SiteShell>
    );
  }

  const isNew = sp.new === "1";
  return (
    <SiteShell>
      <div className="container-x grid max-w-3xl gap-4 py-5 sm:gap-6 sm:py-8">
        {isNew && (
          <div className="card grid justify-items-center gap-3 bg-mint-50 text-center">
            <EggTray className="w-28" />
            <h1 className="font-display text-3xl font-bold">Order placed</h1>
            <span className="num rounded-lg bg-yolk-soft px-4 py-1.5 text-lg font-bold text-yolk-ink">{order.id}</span>
            <p className="max-w-md text-sm text-ink-2">
              {order.trays} tray{order.trays > 1 ? "s" : ""} ({order.trays * 30} eggs) for {order.date === today ? "today" : fmtDay(order.date)}, by {order.slotLabel.split(/[–-]/).pop()?.trim()}.{" "}
              {order.payment === "online" && order.paymentStatus === "paid"
                ? `Payment of ${inr(order.total)} received. Nothing to pay at the door.`
                : `Pay ${inr(order.total)} by ${order.payment === "upi" ? "UPI" : "cash"} on delivery.`}
            </p>
            <p className="text-xs text-ink-3">Keep this order ID. You can always find it under My orders.</p>
          </div>
        )}

        <article className="card grid gap-5">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              {!isNew && <h1 className="num text-xl font-bold">{order.id}</h1>}
              {isNew && <span className="num text-xl font-bold">{order.id}</span>}
              <StatusPill status={order.status} customer />
            </div>
            <b className="num text-lg">{inr(order.total)}</b>
          </header>
          <OrderTimeline order={order} />
          {order.issue && (
            <Note tone="warn">
              You reported: “{order.issue.text}” · {order.issue.resolved ? "resolved" : "we'll get back to you"}
            </Note>
          )}

          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Row k="Delivery" v={`${order.date === today ? "Today" : fmtDay(order.date)}, ${order.slotLabel}`} />
            <Row k="Placed" v={fmtWhen(order.createdAt)} />
            <Row k="Trays" v={`${order.trays} × ${inr(order.unitPrice)}`} />
            <Row k="Delivery fee" v={order.deliveryFee ? inr(order.deliveryFee) : "Free"} />
            <Row k="Payment" v={paymentLabel(order.payment, order.paymentStatus)} />
            <Row k="Deliver to" v={`${order.customer.name} · ${order.customer.phone}`} />
            <div className="sm:col-span-2">
              <dt className="text-ink-3">Address</dt>
              <dd>
                {order.customer.address}
                {order.customer.landmark ? `, near ${order.customer.landmark}` : ""} · {order.customer.pincode}
                {order.customer.lat !== null && order.customer.lng !== null && (
                  <>
                    {" · "}
                    <a href={`https://www.google.com/maps/search/?api=1&query=${order.customer.lat},${order.customer.lng}`} target="_blank" rel="noreferrer" className="font-semibold text-forest-900 hover:underline">
                      View pin
                    </a>
                  </>
                )}
              </dd>
            </div>
            {order.notes && <Row k="Note for rider" v={order.notes} />}
          </dl>

          <OrderActions order={order} phone={owned ? undefined : phone} />
        </article>

        <div className="flex flex-wrap gap-3">
          <AddToCart trays={order.trays}>
            Order again
          </AddToCart>
          <Link href="/orders" className="inline-flex items-center text-sm font-semibold text-forest-900 hover:underline">
            All my orders →
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-ink-3">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
