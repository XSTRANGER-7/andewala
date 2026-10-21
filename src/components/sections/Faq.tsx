import { Section } from "@/components/ui/Section";
import { FAQ } from "@/content/site";

export function Faq() {
  return (
    <Section id="faq" title="Questions" tone="mint">
      <div className="mx-auto grid max-w-2xl gap-3">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-[var(--radius-card)] border border-line bg-paper px-5 py-4 open:shadow-soft">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold marker:content-none">
              {f.q}
              <span className="text-xl leading-none text-sage-600 transition group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
