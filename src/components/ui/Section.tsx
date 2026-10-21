import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionProps = { id?: string; title?: string; intro?: string; className?: string; children: ReactNode; tone?: "paper" | "mint" };

/** Centered section with the uppercase display heading used across the landing page. */
export function Section({ id, title, intro, className, children, tone = "paper" }: SectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-9 sm:py-14", tone === "mint" ? "bg-mint-50" : "bg-paper", className)}>
      <div className="container-x">
        {title && (
          <header className="mx-auto mb-5 max-w-2xl text-center sm:mb-8">
            <h2 className="section-title">{title}</h2>
            {intro && <p className="mt-2 hidden text-sm text-ink-2 sm:block">{intro}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
