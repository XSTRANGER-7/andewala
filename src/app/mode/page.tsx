import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/art/Logo";
import { getUser } from "@/server/customer-auth";
import { getRider } from "@/server/riders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose mode", robots: { index: false } };

/** After a delivery partner logs in: shop as a customer, or switch to rider mode. */
export default async function ModePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/mode");
  const rider = await getRider();
  if (!rider) redirect("/account");
  return (
    <main className="grid min-h-dvh place-items-center bg-mint-50 px-4 py-10">
      <div className="grid w-full max-w-md gap-6">
        <div className="grid justify-items-center gap-2 text-center">
          <Logo name="AndeWala" />
          <h1 className="font-display text-2xl font-bold">Hi {rider.name.split(" ")[0]}, how do you want to continue?</h1>
          <p className="text-sm text-ink-2">You can switch any time.</p>
        </div>
        <a href="/api/mode?to=rider" data-mode="rider" className="card grid gap-1 border-2 border-forest-900 bg-forest-900 text-white transition hover:bg-forest-800">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Delivery partner</span>
          <span className="font-display text-xl font-bold">Rider mode</span>
          <span className="text-sm text-white/85">Today&apos;s orders, the shortest route, and deliveries one stop at a time.</span>
        </a>
        <a href="/api/mode?to=shop" data-mode="shop" className="card grid gap-1 transition hover:border-ink-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">Customer</span>
          <span className="font-display text-xl font-bold">Shop as usual</span>
          <span className="text-sm text-ink-2">Order eggs for yourself.</span>
        </a>
      </div>
    </main>
  );
}
