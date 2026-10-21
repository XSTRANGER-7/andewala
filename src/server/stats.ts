import "server-only";
import { prisma } from "./db";
import { getSettings } from "./settings";

export type PublicStats = { traysDelivered: number; customers: number; windows: number; areas: number };

/** Numbers for the landing page stats strip. */
export async function getPublicStats(): Promise<PublicStats> {
  const [settings, delivered, customers] = await Promise.all([
    getSettings(),
    prisma.order.aggregate({ where: { status: "delivered" }, _sum: { trays: true } }),
    prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(DISTINCT "phone")::int AS n FROM "Order" WHERE "status" <> 'cancelled'`,
  ]);
  return {
    traysDelivered: delivered._sum.trays ?? 0,
    customers: customers[0]?.n ?? 0,
    windows: settings.slots.length,
    areas: settings.pincodes.length || 1,
  };
}
