"use client";

import { useActionState } from "react";
import { EggTray } from "@/components/art/EggTray";
import { Button } from "@/components/ui/Button";
import { subscribeAction } from "@/server/actions/newsletter";

export function Newsletter() {
  const [state, action, pending] = useActionState(subscribeAction, null);
  return (
    <section className="bg-paper py-9 sm:py-14">
      <div className="container-x grid items-center gap-6 lg:grid-cols-2">
        <div className="hidden rounded-[var(--radius-card)] bg-mint-100 p-8 [clip-path:polygon(0_0,100%_0,92%_100%,0_100%)] sm:block sm:p-12">
          <EggTray className="mx-auto w-full max-w-xs drop-shadow-[0_16px_24px_rgb(31_77_63/0.15)]" />
        </div>
        <div className="grid gap-4">
          <h2 className="font-display text-2xl font-semibold text-forest-700 sm:text-3xl">Get tomorrow&apos;s price</h2>
          <p className="text-sm text-ink-2 sm:text-[15px]">One short email each morning with the day&apos;s tray price and how many trays are left.</p>
          <form action={action} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input id="newsletter-email" name="email" type="email" required placeholder="Enter your email" autoComplete="email" className="input flex-1" />
            <Button type="submit" variant="primary" size="lg" loading={pending} className="uppercase tracking-wide">
              Get started
            </Button>
          </form>
          {state && (
            <p className={`text-sm ${state.ok ? "text-good" : "text-bad"}`} role="status">
              {state.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
