import type { Metadata } from "next";
import Link from "next/link";
import { AddToCart } from "@/components/cart/AddToCart";
import { EggTray } from "@/components/art/EggTray";
import { SiteShell } from "@/components/layout/SiteShell";
import { OrderCard } from "@/components/order/OrderCard";
import { ButtonLink } from "@/components/ui/Button";
import { nowIst } from "@/lib/time";
import { ACTIVE_STATUSES } from "@/lib/types";
import { getUser } from "@/server/customer-auth";
import { listCustomerOrders } from "@/server/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My orders", robots: { index: false } };

/** The customer's orders in two groups: on their way, and finished (delivered or cancelled). */
export default async function OrdersPage() {
  const user = await getUser();
  const orders = user ? await listCustomerOrders(user.id) : [];
  const today = nowIst().date;
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const past = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status));

  return (
    <SiteShell>
      <div className="container-x grid max-w-3xl gap-5 py-5 sm:gap-6 sm:py-8">
        <header className="grid gap-1">
          {user && (
            <Link href="/account" className="w-max text-xs font-semibold text-forest-900 hover:underline">
              ← My account
            </Link>
          )}
          <h1 className="font-display text-2xl font-bold sm:text-3xl">My orders</h1>
        </header>

        {!user ? (
          <div className="card grid justify-items-center gap-3 text-center">
            <EggTray filled={0} className="w-28" />
            <h2 className="font-display text-xl font-bold">Log in to see your orders</h2>
            <p className="max-w-sm text-sm text-ink-2">Your orders are kept on your account, on any phone.</p>
            <ButtonLink href="/login?next=/orders" variant="sage">
              Log in or sign up
            </ButtonLink>
          </div>
        ) : orders.length === 0 ? (
          <div className="card grid justify-items-center gap-3 text-center">
            <EggTray filled={0} className="w-28" />
            <h2 className="font-display text-xl font-bold">No orders yet</h2>
            <p className="max-w-sm text-sm text-ink-2">Your first tray is a tap away. Orders show up here with live delivery status.</p>
            <AddToCart>Order eggs</AddToCart>
          </div>
        ) : (
          <>
            <section className="grid gap-3" aria-labelledby="active-orders">
              <h2 id="active-orders" className="flex items-baseline gap-2 font-display text-lg font-bold">
                Active orders <span className="text-sm font-semibold text-ink-3">{active.length}</span>
              </h2>
              {active.length ? (
                active.map((o) => <OrderCard key={o.id} order={o} today={today} />)
              ) : (
                <p className="card text-sm text-ink-2">Nothing on its way right now.</p>
              )}
            </section>

            <section className="grid gap-3" aria-labelledby="past-orders">
              <h2 id="past-orders" className="flex items-baseline gap-2 font-display text-lg font-bold">
                Past orders <span className="text-sm font-semibold text-ink-3">{past.length}</span>
              </h2>
              {past.length ? past.map((o) => <OrderCard key={o.id} order={o} today={today} />) : <p className="card text-sm text-ink-2">Delivered and cancelled orders appear here.</p>}
            </section>
          </>
        )}
      </div>
    </SiteShell>
  );
}
