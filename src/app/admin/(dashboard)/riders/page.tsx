import type { Metadata } from "next";
import { RidersManager } from "@/components/admin/RidersManager";
import { prisma } from "@/server/db";
import { listRiders, riderAccounts, riderCandidates } from "@/server/riders";

export const metadata: Metadata = { title: "Riders" };

export default async function RidersPage() {
  const riders = await listRiders();
  const [candidates, ready] = await Promise.all([riderCandidates(), riderAccounts(riders.map((r) => r.email).filter(Boolean))]);
  const busy = await prisma.order.groupBy({ by: ["riderId"], where: { status: "out", riderId: { not: null } }, _count: true });
  const out = Object.fromEntries(busy.map((b) => [b.riderId as string, b._count]));
  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h1 className="font-display text-2xl font-bold">Riders</h1>
        <p className="text-sm text-ink-2">
          Add a delivery partner by the email they log in with. After logging in they choose Rider mode or shopping, and rider mode shows today&apos;s orders in the shortest route.
        </p>
      </header>
      <RidersManager riders={riders} out={out} candidates={candidates} ready={[...ready]} />
    </div>
  );
}
