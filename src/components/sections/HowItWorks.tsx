import { AddToCart } from "@/components/cart/AddToCart";
import { SceneDoor, SceneFarm, SceneOrder } from "@/components/art/StoryScenes";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { inr } from "@/lib/money";
import { fmtTime } from "@/lib/time";
import type { Availability } from "@/lib/types";

/** The order-to-door story in three illustrated scenes joined by a moving route line. */
export function HowItWorks({ a }: { a: Availability }) {
  const steps = [
    {
      Scene: SceneOrder,
      when: `Before ${fmtTime(a.cutoff)}`,
      title: "You order in a tap",
      text: "Pick how many trays, choose an evening window and confirm. No account, nothing to pay yet.",
    },
    {
      Scene: SceneFarm,
      when: "This morning",
      title: "We collect from the farm",
      text: "Our rider picks up today's eggs straight from the farm and packs your tray by hand.",
    },
    {
      Scene: SceneDoor,
      when: `By ${fmtTime(a.deadline)}`,
      title: "Fresh eggs at your door",
      text: "The tray is handed over in your window. Check the eggs, pay cash if you didn't pay online, done.",
    },
  ];

  return (
    <Section id="how" title="How it works" intro="From a tap on your phone to a tray at your door, the same evening.">
      <div className="relative">
        {/* route line: horizontal behind the cards on laptops, vertical beside them on phones */}
        <svg className="pointer-events-none absolute left-5 top-6 hidden h-[calc(100%-3rem)] w-2 sm:left-1/2 sm:top-[28%] sm:block sm:h-2 sm:w-full sm:-translate-x-1/2" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 2">
          <path d="M0 1H100" className="route-dash" stroke="var(--color-sage-400)" strokeWidth="2" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" fill="none" />
        </svg>
        <ol className="relative grid gap-4 sm:grid-cols-3 sm:gap-4">
          {steps.map(({ Scene, when, title, text }, i) => (
            <li key={title} className="relative">
              <Reveal delay={i * 140} className="h-full">
                <article className="grid h-full content-start gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-3 shadow-soft sm:p-4">
                  <div className="relative overflow-hidden rounded-[12px]">
                    <Scene />
                    <span className="num absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-yolk font-display text-sm font-extrabold text-yolk-ink shadow-soft">{i + 1}</span>
                  </div>
                  <div className="grid gap-1 px-1 pb-1">
                    <span className="eyebrow">{when}</span>
                    <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
                    <p className="text-sm text-ink-2">{text}</p>
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        <AddToCart size="lg" className="w-full sm:w-auto sm:min-w-[14rem]">
          {a.status.open ? `Start my order · ${inr(a.price)}` : "See delivery days"}
        </AddToCart>
        <p className="text-xs text-ink-3">Minimum 1 tray · 30 eggs · {a.deliveryFee === 0 ? "free delivery" : "delivery " + inr(a.deliveryFee)}</p>
      </div>
    </Section>
  );
}
