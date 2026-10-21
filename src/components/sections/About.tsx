import { AddToCart } from "@/components/cart/AddToCart";
import { EggTray } from "@/components/art/EggTray";
import { fmtTime } from "@/lib/time";
import type { StoreSettings } from "@/lib/types";

export function About({ s }: { s: StoreSettings }) {
  return (
    <section id="about" className="scroll-mt-20 bg-paper py-9 sm:py-14">
      <div className="container-x grid items-center gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="order-2 grid gap-4 sm:gap-5 lg:order-1">
          <h2 className="section-title">About us</h2>
          <p className="text-sm text-ink-2 sm:text-[15px]">
            {s.storeName} started with one question: why should fresh eggs cost more by the time they reach your kitchen? We buy directly from a nearby
            farm every morning, pack the trays ourselves and deliver them the same evening. No distributor, no cold storage, no week-old stock.
          </p>
          <p className="hidden text-sm text-ink-2 sm:block sm:text-[15px]">
            The price you see is today&apos;s farm rate plus a small, fixed margin for packing and delivery. It changes with the market, and we show you
            exactly when it last moved.
          </p>
          <ul className="grid gap-2 text-sm text-ink">
            <li className="flex gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yolk" />
              Same-day orders until {fmtTime(s.cutoff)}, delivered by {fmtTime(s.deadline)}
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yolk" />
              {s.deliveryFee === 0 ? "Free home delivery on every order" : s.freeDeliveryFrom > 0 ? `Free delivery on ${s.freeDeliveryFrom} trays or more` : `Delivery ${s.deliveryFee ? "₹" + s.deliveryFee : "free"} per order`}
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yolk" />
              Minimum order one tray of 30 eggs
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yolk" />
              Cancel free until we pack your order
            </li>
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <AddToCart>
              Buy now
            </AddToCart>
          </div>
        </div>
        <div className="relative order-1 hidden sm:block lg:order-2">
          <div className="absolute -right-2 -top-6 grid grid-cols-6 gap-2 opacity-60" aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className="h-1 w-1 rounded-full bg-forest-900" />
            ))}
          </div>
          <div className="rounded-[var(--radius-card)] bg-mint-100 p-8 sm:p-12">
            <EggTray className="mx-auto w-full max-w-sm drop-shadow-[0_16px_24px_rgb(31_77_63/0.15)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
