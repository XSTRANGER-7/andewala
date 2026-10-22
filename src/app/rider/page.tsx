import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/art/Logo";
import { LogoutButton } from "@/components/account/LogoutButton";
import { RiderBoard } from "@/components/rider/RiderBoard";
import { getUser } from "@/server/customer-auth";
import { getRider, riderBoard } from "@/server/riders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rider", robots: { index: false } };

/** Rider mode: its own screen, no shop header or tabs. */
function RiderShell({ name, children }: { name?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-mint-50" data-rider-mode>
      <header className="sticky top-0 z-30 border-b border-line bg-forest-900 text-white">
        <div className="container-x flex h-14 max-w-3xl items-center gap-3">
          <span className="rounded-lg bg-paper px-2 py-1">
            <Logo name="AndeWala" />
          </span>
          <span className="rounded-full bg-yolk px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink">Rider</span>
          {name && <span className="hidden truncate text-sm text-white/80 sm:inline">{name}</span>}
          <a href="/api/mode?to=shop" className="ml-auto rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
            Switch to shopping
          </a>
        </div>
      </header>
      <main className="container-x max-w-3xl py-5 pb-24 sm:py-8">{children}</main>
    </div>
  );
}

export default async function RiderPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/mode");
  const rider = await getRider();
  if (!rider) {
    return (
      <RiderShell>
        <div className="grid gap-3 py-10 text-center">
          <h1 className="font-display text-2xl font-bold">Not a delivery partner</h1>
          <p className="text-sm text-ink-2">This mobile number isn&apos;t set up as a delivery partner. Ask the store to add it under Admin › Riders, then log in again.</p>
          <a href="/api/mode?to=shop" className="font-semibold text-forest-900 hover:underline">
            Back to the shop
          </a>
        </div>
      </RiderShell>
    );
  }
  const board = await riderBoard(rider);
  return (
    <RiderShell name={rider.name}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Rider mode</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Hi, {rider.name.split(" ")[0]}</h1>
        </div>
        <div className="text-sm">
          <LogoutButton />
        </div>
      </div>
      <RiderBoard riderName={rider.name} board={board} />
    </RiderShell>
  );
}
