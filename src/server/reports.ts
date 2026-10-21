import "server-only";
import { ACTIVE_STATUSES, type OrderView } from "@/lib/types";
import { addDays } from "@/lib/time";

export type DayStats = { date: string; orders: OrderView[]; trays: number; revenue: number; contribution: number; pending: number };

/** Sales figures for one delivery date from a list of orders. */
export function dayStats(orders: OrderView[], date: string): DayStats {
  const os = orders.filter((o) => o.date === date && o.status !== "cancelled");
  return {
    date,
    orders: os,
    trays: os.reduce((a, o) => a + o.trays, 0),
    revenue: os.reduce((a, o) => a + o.total, 0),
    contribution: os.reduce((a, o) => a + o.trays * (o.unitPrice - o.productCost) + o.deliveryFee - o.deliveryCost, 0),
    pending: os.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
  };
}

/** The last `days` days ending today, oldest first. */
export function trailingDays(orders: OrderView[], today: string, days = 7): DayStats[] {
  return Array.from({ length: days }, (_, i) => dayStats(orders, addDays(today, i - (days - 1))));
}
