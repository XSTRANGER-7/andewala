"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fades its children in when they scroll into view.
 *
 * Content is visible by default. Only when this script runs, and only for
 * elements that start below the fold, is the element "armed" (hidden) and then
 * revealed by an IntersectionObserver. If JavaScript fails or is slow, nothing
 * stays invisible.
 */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return; // already on screen: leave it shown

    el.classList.add("reveal-armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    io.observe(el);
    // Safety net: never leave content hidden for long.
    const t = window.setTimeout(() => el.classList.add("is-visible"), 4000);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);
  return (
    <div ref={ref} className={className} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
