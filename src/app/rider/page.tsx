import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { RiderBoard } from "@/components/rider/RiderBoard";
import { getUser } from "@/server/customer-auth";
import { getRider, riderBoard } from "@/server/riders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Deliveries", robots: { index: false } };

export default async function RiderPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/rider");
  const rider = await getRider();
  if (!rider) {
    return (
      <SiteShell>
        <div className="container-x grid max-w-xl gap-3 py-10 text-center">
          <h1 className="font-display text-2xl font-bold">Not a delivery partner</h1>
          <p className="text-sm text-ink-2">This mobile number isn&apos;t set up as a delivery partner. Ask the store to add it under Admin › Riders, then log in again.</p>
          <Link href="/" className="font-semibold text-forest-900 hover:underline">
            Back to the shop
          </Link>
        </div>
      </SiteShell>
    );
  }
  const board = await riderBoard(rider);
  return (
    <SiteShell>
      <div className="container-x max-w-3xl py-5 sm:py-8">
        <RiderBoard riderName={rider.name} board={board} />
      </div>
    </SiteShell>
  );
}
