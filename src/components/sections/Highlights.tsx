import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { IconClock, IconLeaf, IconShield, IconTag, IconTray, IconTruck } from "@/components/ui/Icons";
import { fmtTime } from "@/lib/time";
import type { StoreSettings } from "@/lib/types";

/** The reasons to order, as compact animated cards: icon and heading only. Delivery wording follows the live settings. */
export function Highlights({ s }: { s: StoreSettings }) {
  const delivery = s.deliveryFee === 0 ? "Free home delivery" : s.freeDeliveryFrom > 0 ? `Free delivery on ${s.freeDeliveryFrom}+ trays` : "Doorstep delivery";

  const items = [
    { Icon: IconTruck, title: delivery },
    { Icon: IconClock, title: `Same-day delivery by ${fmtTime(s.deadline)}` },
    { Icon: IconTray, title: "30 eggs per tray" },
    { Icon: IconLeaf, title: "Farm fresh, every morning" },
    { Icon: IconShield, title: "Quality checked" },
    { Icon: IconTag, title: "One fair price" },
  ];

  return (
    <Section id="why" title={`Why ${s.storeName}?`} intro="Everything about the way we sell eggs is built around freshness and a price you can trust." tone="mint">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {items.map(({ Icon, title }, i) => (
          <li key={title}>
            <Reveal delay={(i % 3) * 90} className="h-full">
              <div className="group flex h-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper px-3 py-5 text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-float sm:py-7">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-mint-100 text-forest-900 transition group-hover:bg-yolk-soft group-hover:text-yolk-ink">
                  <Icon width={24} height={24} strokeWidth={1.7} />
                </span>
                <h3 className="text-[15px] font-bold leading-snug sm:text-base">{title}</h3>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
