"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { EggTray } from "@/components/art/EggTray";
import { CartLine, OrderForm, type CheckoutAccount } from "@/components/order/OrderForm";
import { ButtonLink } from "@/components/ui/Button";
import { IconUser } from "@/components/ui/Icons";
import { deliveryFeeFor } from "@/lib/pricing";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { IconCheck, IconClock, IconTruck } from "@/components/ui/Icons";
import { addToCart, useCartDraft } from "@/lib/cart";
import { inr } from "@/lib/money";
import { fmtTime } from "@/lib/time";
import type { Availability } from "@/lib/types";

const subscribeNoop = () => () => {};

/**
 * The cart page body. The cart lives in this browser, so the server can't
 * render it: a skeleton shows until hydration, then either the empty cart or
 * the cart line with checkout.
 */
/** `account` is null when nobody is logged in: the cart still works, but checkout asks them to log in. */
export function CartCheckout({ a, addTrays, newAddress, account }: { a: Availability; addTrays: number | null; newAddress: boolean; account: CheckoutAccount | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const draft = useCartDraft();
  const pending = !!addTrays || newAddress;

  // Links like /cart?trays=2 (and the old /order?trays=2) put that many trays in the cart, then tidy the URL.
  useEffect(() => {
    if (!pending) return;
    if (addTrays) {
      const n = addToCart(addTrays);
      toast(`${n} tray${n === 1 ? "" : "s"} in your cart`);
    }
    if (newAddress && !addTrays) addToCart();
    router.replace(newAddress ? "/cart#delivery-address" : "/cart", { scroll: false });
  }, [pending, addTrays, newAddress, router, toast]);

  if (!hydrated || (pending && !draft)) {
    return (
      <div className="card grid gap-3" aria-busy="true" aria-label="Loading your cart">
        <div className="h-6 w-40 animate-pulse rounded bg-mint-100" />
        <div className="h-24 animate-pulse rounded bg-mint-50" />
      </div>
    );
  }

  if (!draft) return <EmptyCart a={a} />;

  if (!account) return <GuestCheckout a={a} trays={draft.trays} />;

  return <OrderForm a={a} trays={draft.trays} account={account} />;
}

/** The cart for someone who isn't logged in: their tray line, then a clear log-in step. */
function GuestCheckout({ a, trays }: { a: Availability; trays: number }) {
  const t = Math.max(1, Math.min(trays, a.maxTrays));
  const fee = deliveryFeeFor(t, a.deliveryFee, a.freeDeliveryFrom);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="card grid gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Items</h2>
          <span className="text-xs text-ink-3">
            {t} tray{t === 1 ? "" : "s"} · {t * 30} eggs
          </span>
        </div>
        <CartLine a={a} trays={t} fee={fee} />
      </div>
      <aside className="card grid content-start gap-3 self-start border-forest-900/30 bg-mint-50 lg:sticky lg:top-20" aria-label="Log in to order">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-paper text-forest-900 shadow-soft">
          <IconUser />
        </span>
        <h2 className="font-display text-lg font-bold">Log in to place your order</h2>
        <p className="text-sm text-ink-2">Use your mobile number or email and a one-time code. Your cart stays saved, and your addresses are kept for next time.</p>
        <div className="flex items-baseline justify-between border-t border-line pt-3 text-sm">
          <span>Total</span>
          <span className="num text-lg font-bold">{inr(t * a.price + fee)}</span>
        </div>
        <ButtonLink href="/login?next=/cart" variant="sage" size="lg" className="w-full">
          Log in or sign up
        </ButtonLink>
      </aside>
    </div>
  );
}

function EmptyCart({ a }: { a: Availability }) {
  const { toast } = useToast();
  const canBuy = a.status.open && a.available > 0;
  return (
    <section className="card grid max-w-2xl justify-items-center gap-4 py-10 text-center" aria-label="Empty cart">
      <div className="grid h-28 w-28 place-items-center rounded-full bg-mint-100">
        <EggTray filled={0} className="w-20" />
      </div>
      <div className="grid gap-1">
        <h2 className="font-display text-2xl font-bold">Your cart is empty</h2>
        <p className="mx-auto max-w-sm text-sm text-ink-2">Add a tray of farm-fresh eggs to get started. Your cart stays on this phone, so you can finish later.</p>
      </div>
      <Button
        variant="sage"
        size="lg"
        disabled={!canBuy}
        onClick={() => {
          addToCart(1);
          toast("1 tray in your cart");
        }}
      >
        Add 1 tray · {inr(a.price)}
      </Button>
      <ul className="grid gap-2 text-left text-sm text-ink-2 sm:grid-cols-3 sm:gap-4">
        <li className="flex items-center gap-2">
          <IconTruck width={16} height={16} className="text-forest-900" />
          {a.deliveryFee === 0 ? "Free home delivery" : "Doorstep delivery"}
        </li>
        <li className="flex items-center gap-2">
          <IconClock width={16} height={16} className="text-forest-900" />
          Same day by {fmtTime(a.deadline)}
        </li>
        <li className="flex items-center gap-2">
          <IconCheck width={16} height={16} className="text-forest-900" />
          30 eggs per tray
        </li>
      </ul>
    </section>
  );
}
