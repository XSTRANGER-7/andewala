import { AddToCart } from "@/components/cart/AddToCart";
import { HeroProduct } from "@/components/art/HeroProduct";
import { IconClock, IconLeaf, IconShield, IconTruck, IconWallet } from "@/components/ui/Icons";
import { inr } from "@/lib/money";
import { fmtTime } from "@/lib/time";
import type { Availability } from "@/lib/types";

/**
 * Phones: the animated tray, today's price, the one-tray minimum and the Order
 * button, nothing more. Laptops (lg and up) add a headline, a supporting line,
 * a price card with a secondary link, a trust row, and two floating cards
 * around the tray. Every claim comes from the live store settings.
 */
export function Hero({ a }: { a: Availability }) {
  const freeFrom = a.deliveryFee > 0 && a.freeDeliveryFrom > 0 ? a.freeDeliveryFrom : 0;
  const deliveryLine = a.deliveryFee === 0 ? "Free home delivery" : freeFrom ? `Free delivery on ${freeFrom}+ trays` : "Doorstep delivery";
  const trust = [
    { Icon: IconTruck, text: deliveryLine },
    { Icon: IconWallet, text: "Pay cash or UPI at the door" },
    { Icon: IconShield, text: "Broken eggs replaced" },
  ];

  return (
    <section id="product" className="relative scroll-mt-20 overflow-hidden bg-mint-100 lg:flex lg:min-h-[min(calc(100svh-101px),64rem)] lg:items-center">
      {/* laptop-only backdrop: soft glow and a faint dot grid behind the tray */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <div className="absolute -right-24 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full bg-paper/60 blur-3xl" />
      </div>

      <h1 className="sr-only lg:hidden">{a.storeName}: farm-fresh 30-egg trays delivered same day</h1>

      <div className="container-x relative grid items-center gap-3 py-5 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-10 2xl:gap-20">
        {/* product: first on phones, right column on laptops */}
        <div className="relative order-1 lg:order-2">
          <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-6 hidden h-40 w-56 bg-[radial-gradient(var(--color-sage-400)_1.2px,transparent_1.2px)] [background-size:16px_16px] opacity-40 lg:block" />
          <span className="absolute right-2 top-2 z-10 grid h-16 w-16 rotate-12 place-items-center rounded-full bg-yolk text-center font-display text-[10px] font-extrabold uppercase leading-tight text-yolk-ink shadow-float sm:right-6 sm:top-4 sm:h-24 sm:w-24 sm:text-xs">
            {a.deliveryFee === 0 ? (
              <>
                Free
                <br />
                delivery
              </>
            ) : freeFrom ? (
              <>
                Free
                <br />
                delivery
                <br />
                {freeFrom}+ trays
              </>
            ) : (
              <>
                Same
                <br />
                day
              </>
            )}
          </span>
          <HeroProduct animated className="relative mx-auto max-w-[22rem] drop-shadow-[0_24px_30px_rgb(31_77_63/0.18)] sm:max-w-md lg:max-w-2xl 2xl:max-w-3xl" />

          {/* laptop: floating info cards */}
          <div className="float absolute -left-4 bottom-10 hidden items-center gap-3 rounded-2xl bg-paper/95 px-4 py-3 shadow-float backdrop-blur lg:flex" style={{ animationDelay: "-2s" }}>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-mint-100 text-forest-900">
              <IconLeaf width={20} height={20} />
            </span>
            <span className="grid leading-tight">
              <span className="text-sm font-bold text-ink">Collected this morning</span>
              <span className="text-xs text-ink-3">Straight from the farm, never stored</span>
            </span>
          </div>
          <div className="float absolute -bottom-2 right-6 hidden items-center gap-3 rounded-2xl bg-forest-900 px-4 py-3 text-white shadow-float lg:flex" style={{ animationDelay: "-4s" }}>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-yolk">
              <IconClock width={20} height={20} />
            </span>
            <span className="grid leading-tight">
              <span className="text-sm font-bold">Delivered by {fmtTime(a.deadline)}</span>
              <span className="text-xs text-white/70">Order before {fmtTime(a.cutoff)} for today</span>
            </span>
          </div>
        </div>

        {/* copy */}
        <div className="relative z-10 order-2 grid gap-4 lg:order-1 lg:gap-6 2xl:gap-8">
          {/* laptop: tag, headline and one supporting line */}
          <div className="hidden gap-4 lg:mb-10 lg:grid 2xl:mb-14">
            <h1 className="font-display text-[clamp(2.75rem,4.6vw,5rem)] text-nowrap font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">
              Farm-fresh eggs,
              <br />
              <span className="text-sage-600">delivered today.</span>
            </h1>
          </div>

          {/* price and order: the whole hero on phones, a card on laptops */}
          <div className="grid gap-4 lg:max-w-md lg:rounded-2xl lg:border lg:border-line lg:bg-paper lg:p-5 lg:shadow-soft 2xl:max-w-lg 2xl:gap-5 2xl:p-7">
            <p className="eyebrow">Today&apos;s price · 30-egg tray</p>
            <div>
              <div>
                <div className="num font-display text-5xl font-extrabold tracking-tight text-ink 2xl:text-6xl">
                  {inr(a.price)}
                  <span className="ml-1 text-base font-semibold text-ink-3">/ tray</span>
                </div>
                <p className="mt-1 text-xs text-ink-3">Minimum 1 tray · 30 eggs</p>
              </div>
            </div>
            <AddToCart size="lg" className="w-full shadow-float">
              {a.status.open ? `Order now · ${inr(a.price)}` : "See delivery days"}
            </AddToCart>
            {a.status.open && <p className="text-center text-xs text-ink-2 lg:text-left">{a.status.detail}</p>}
          </div>

          {/* laptop: trust row */}
          <ul className="hidden flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-2 lg:flex 2xl:text-base" aria-label="Why order here">
            {trust.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon width={17} height={17} className="text-forest-900" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
