"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { IconBasket } from "@/components/ui/Icons";
import { ADDED_EVENT, useCartDraft } from "@/lib/cart";
import { cn } from "@/lib/cn";

/**
 * Header cart. When the cart holds trays the icon turns solid yolk with the
 * tray count on it; adding to the cart makes it pop. Orders already placed and
 * on their way are shown as a small green dot, not mixed into the count.
 */
export function CartButton({ activeOrders }: { activeOrders: number }) {
  const draft = useCartDraft();
  const pathname = usePathname();
  const ref = useRef<HTMLAnchorElement>(null);
  const trays = draft?.trays ?? 0;
  const filled = trays > 0;
  const on = pathname === "/cart";

  // Pop the icon whenever something is added, even from a page that then navigates to the cart.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pop = () => {
      el.classList.remove("cart-pop");
      void el.offsetWidth; // restart the animation
      el.classList.add("cart-pop");
    };
    window.addEventListener(ADDED_EVENT, pop);
    return () => window.removeEventListener(ADDED_EVENT, pop);
  }, []);

  const label = filled
    ? `Cart, ${trays} tray${trays === 1 ? "" : "s"}${activeOrders ? `, ${activeOrders} order${activeOrders === 1 ? "" : "s"} on the way` : ""}`
    : activeOrders
      ? `Cart is empty, ${activeOrders} order${activeOrders === 1 ? "" : "s"} on the way`
      : "Cart is empty";

  return (
    <Link
      ref={ref}
      href="/cart"
      aria-label={label}
      data-filled={filled || undefined}
      className={cn(
        "relative inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-full transition max-[379px]:h-9 sm:gap-1.5",
        filled ? "bg-yolk px-2.5 text-yolk-ink max-[379px]:px-2 sm:px-3 shadow-soft hover:brightness-105" : cn("w-10 text-ink hover:bg-mint-100 max-[379px]:w-9", on && "bg-mint-100 text-forest-900"),
      )}
    >
      <IconBasket width={21} height={21} strokeWidth={filled ? 2 : 1.7} className="max-[379px]:h-[18px] max-[379px]:w-[18px]" />
      {filled && <span className="num text-sm font-bold max-[379px]:text-[13px]">{trays}</span>}
      {activeOrders > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-good ring-2 ring-paper" aria-hidden="true" />}
    </Link>
  );
}
