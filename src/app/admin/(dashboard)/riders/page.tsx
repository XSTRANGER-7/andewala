import type { Metadata } from "next";
import { RidersManager } from "@/components/admin/RidersManager";
import { prisma } from "@/server/db";
import { listRiders } from "@/server/riders";

export const metadata: Metadata = { title: "Riders" };

export default async function RidersPage() {
  const riders = await listRiders();
  const busy = await prisma.order.groupBy({ by: ["riderId"], where: { status: "out", riderId: { not: null } }, _count: true });
  const out = Object.fromEntries(busy.map((b) => [b.riderId as string, b._count]));
  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h1 className="font-display text-2xl font-bold">Riders</h1>
        <p className="text-sm text-ink-2">
          Delivery partners log in on the website with their mobile number (the usual OTP) and get the delivery dashboard: today&apos;s orders, the shortest route, and delivery confirmation.
        </p>
      </header>
      <RidersManager riders={riders} out={out} />
    </div>
  );
}
