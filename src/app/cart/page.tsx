import type { Metadata } from "next";
import Link from "next/link";
import { CartCheckout } from "@/components/cart/CartCheckout";
import { SiteShell } from "@/components/layout/SiteShell";
import { OrderCard } from "@/components/order/OrderCard";
import { Note } from "@/components/ui/Note";
import { fmtTime, nowIst } from "@/lib/time";
import { ACTIVE_STATUSES } from "@/lib/types";
import { getAvailability, listCustomerOrders } from "@/server/orders";
import { getUser } from "@/server/customer-auth";
import { getProfile, profileComplete } from "@/server/accounts";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cart", robots: { index: false } };

type Props = { searchParams: Promise<{ trays?: string; newAddress?: string }> };

/** The cart is the checkout: trays, delivery, address and payment on one page, with orders on the way below. */
export default async function CartPage({ searchParams }: Props) {
  const [sp, user, availability] = await Promise.all([searchParams, getUser(), getAvailability()]);
  const profile = user ? await getProfile(user.id) : null;
  // Logged in but the profile isn't finished (no name or mobile yet): finish it first.
  if (profile && !profileComplete(profile)) redirect("/login?next=/cart");
  const orders = user ? await listCustomerOrders(user.id) : [];
  const account = profile ? { addresses: profile.addresses, defaults: { name: profile.name, phone: profile.phone ?? "" } } : null;
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const today = nowIst().date;
  const addTrays = sp.trays ? Math.max(1, Number.parseInt(sp.trays, 10) || 1) : null;

  return (
    <SiteShell>
      <div className="container-x grid gap-4 py-5 sm:gap-6 sm:py-8">
        <header className="grid gap-1">
          <p className="eyebrow">Cart</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Your cart</h1>
          <p className="text-sm text-ink-2">
            Same-day orders close at {fmtTime(availability.cutoff)}. Delivered by {fmtTime(availability.deadline)}.
            {availability.deliveryFee === 0 ? " Free home delivery." : ""} Pay cash or UPI at the door.
          </p>
        </header>

        {!availability.status.open && (
          <Note tone={availability.status.tone === "bad" ? "bad" : "warn"}>
            <b>{availability.status.text}.</b> {availability.status.detail}
          </Note>
        )}

        <CartCheckout a={availability} addTrays={addTrays} newAddress={sp.newAddress === "1"} account={account} />

        {active.length > 0 && (
          <section className="grid max-w-3xl gap-3" aria-label="Active orders">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-bold">On the way</h2>
              <Link href="/orders" className="text-sm font-semibold text-forest-900 hover:underline">
                All orders →
              </Link>
            </div>
            {active.map((o) => (
              <OrderCard key={o.id} order={o} today={today} />
            ))}
          </section>
        )}
      </div>
    </SiteShell>
  );
}
