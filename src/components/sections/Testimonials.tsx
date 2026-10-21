import { Section } from "@/components/ui/Section";
import { IconQuote } from "@/components/ui/Icons";
import { TESTIMONIALS } from "@/content/site";

const COLORS = ["bg-sage-400", "bg-yolk", "bg-forest-700", "bg-sage-600"];

function Card({ t, i }: { t: (typeof TESTIMONIALS)[number]; i: number }) {
  return (
    <figure className="relative mt-8 w-[78vw] max-w-[22rem] shrink-0 rounded-[var(--radius-card)] bg-paper p-6 pt-10 shadow-soft sm:w-[22rem]">
      <span className={`absolute -top-7 left-6 grid h-14 w-14 place-items-center rounded-full border-4 border-paper text-base font-bold text-white ${COLORS[i % COLORS.length]}`} aria-hidden="true">
        {t.name[0]}
      </span>
      <IconQuote className="absolute right-5 top-4 text-sage-300" width={28} height={28} />
      <div className="mb-2 text-sm tracking-widest text-yolk" aria-label="5 out of 5">
        ★★★★★
      </div>
      <blockquote className="text-sm text-ink-2">{t.text}</blockquote>
      <figcaption className="mt-4">
        <div className="text-sm font-semibold">{t.name}</div>
        <div className="text-xs text-ink-3">{t.area}</div>
      </figcaption>
    </figure>
  );
}

/** Reviews glide sideways on a loop; hovering or touching pauses them. */
export function Testimonials() {
  return (
    <Section id="reviews" title="Testimonials" intro="What neighbours say after their first few trays.">
      <div className="reviews -mx-3 overflow-hidden px-3 pb-4 sm:mx-0" aria-label="Customer reviews">
        <div className="reviews-track gap-5">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-5 pr-5" aria-hidden={copy === 1 || undefined}>
              {TESTIMONIALS.map((t, i) => (
                <Card key={`${copy}-${t.name}`} t={t} i={i} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
