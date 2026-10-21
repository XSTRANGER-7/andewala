import { fmtTime } from "@/lib/time";
import type { StoreSettings } from "@/lib/types";

/** Offer strip above the header: a moving marquee on phones, a static row on larger screens. Text comes from the live settings. */
export function PromoBar({ s }: { s: StoreSettings }) {
  const items = [
    s.deliveryFee === 0 ? "Free home delivery on every order" : s.freeDeliveryFrom > 0 ? `Free delivery on ${s.freeDeliveryFrom}+ trays` : null,
    `Order before ${fmtTime(s.cutoff)} for same-day delivery`,
    "Pay online or cash on delivery",
    "Farm-fresh, collected this morning",
    "Minimum order 1 tray · 30 eggs",
  ].filter(Boolean) as string[];

  const Item = ({ text }: { text: string }) => (
    <span className="inline-flex items-center gap-2 pr-8">
      <span className="h-1.5 w-1.5 rounded-full bg-yolk" aria-hidden="true" />
      {text}
    </span>
  );

  return (
    <div className="bg-forest-900 text-xs font-semibold text-white">
      {/* phone: marquee */}
      <div className="marquee h-9 overflow-hidden sm:hidden" aria-label="Offers">
        <div className="marquee-track h-9 items-center" aria-hidden="true">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0 items-center">
              {items.map((t) => (
                <Item key={t} text={t} />
              ))}
            </span>
          ))}
        </div>
        <span className="sr-only">{items.join(". ")}</span>
      </div>
      {/* tablet and up: static */}
      <div className="container-x hidden h-9 items-center justify-center gap-2 whitespace-nowrap sm:flex">
        {items.slice(0, 3).map((t) => (
          <Item key={t} text={t} />
        ))}
      </div>
    </div>
  );
}
