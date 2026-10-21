import type { Metadata } from "next";
import { CartCheckout } from "@/components/cart/CartCheckout";
import { SiteShell } from "@/components/layout/SiteShell";
import { ClosedBanner } from "@/components/store/StoreStatus";
import { fmtTime } from "@/lib/time";
import { getAvailability } from "@/server/orders";
import { getUser } from "@/server/customer-auth";
import { getProfile, profileComplete } from "@/server/accounts";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cart", robots: { index: false } };

type Props = { searchParams: Promise<{ trays?: string; newAddress?: string }> };

/** The cart is the checkout: trays, delivery, address and payment on one page. */
export default async function CartPage({ searchParams }: Props) {
  const [sp, user, availability] = await Promise.all([searchParams, getUser(), getAvailability()]);
  const profile = user ? await getProfile(user.id) : null;
  // Logged in but the profile isn't finished (no name or mobile yet): finish it first.
  if (profile && !profileComplete(profile)) redirect("/login?next=/cart");
  const account = profile ? { addresses: profile.addresses, defaults: { name: profile.name, phone: profile.phone ?? "" } } : null;
  const addTrays = sp.trays ? Math.max(1, Number.parseInt(sp.trays, 10) || 1) : null;

  return (
    <SiteShell>
      <div className="container-x grid gap-4 py-5 sm:gap-6 sm:py-8">
        <header className="grid gap-1">
          <p className="eyebrow">Cart</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Your cart</h1>
          <p className="text-sm text-ink-2">
            Same-day orders close at {fmtTime(availability.cutoff)}. Delivered by {fmtTime(availability.deadline)}.
            {availability.deliveryFee === 0 ? " Free home delivery." : ""} Pay online (UPI, cards) or cash on delivery.
          </p>
        </header>

        <ClosedBanner status={availability.status} />

        <CartCheckout a={availability} addTrays={addTrays} newAddress={sp.newAddress === "1"} account={account} />

      </div>
    </SiteShell>
  );
}
