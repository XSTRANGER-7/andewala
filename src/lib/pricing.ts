import type { Costs, StoreSettings } from "./types";

/** Product cost per tray, excluding delivery. */
export function productCost(c: Costs): number {
  return c.farm + c.inbound + c.packaging + c.payment;
}

/** Full cost per tray including the per-order delivery cost. */
export function fullCost(c: Costs): number {
  return productCost(c) + c.delivery;
}

/** The price customers pay right now, honouring a scheduled price once its date arrives. */
export function effectivePrice(s: StoreSettings, today: string): { price: number; since: string | null } {
  if (s.scheduled && s.scheduled.date <= today) {
    return { price: s.scheduled.price, since: s.scheduled.date + "T00:00:00+05:30" };
  }
  return { price: s.price, since: s.priceUpdatedAt ? s.priceUpdatedAt.toISOString() : null };
}

/** Delivery fee for a given tray count. */
export function deliveryFeeFor(qty: number, deliveryFee: number, freeDeliveryFrom: number): number {
  if (freeDeliveryFrom > 0 && qty >= freeDeliveryFrom) return 0;
  return deliveryFee;
}

export function orderTotal(qty: number, unitPrice: number, fee: number): number {
  return qty * unitPrice + fee;
}

/** Margin picture for the admin pricing screen. */
export function marginReport(price: number, costs: Costs, target: number, feeForOne: number) {
  const cost = fullCost(costs);
  const margin = price - cost;
  return {
    cost,
    margin,
    contributionOneTray: margin + feeForOne,
    tone: margin < 0 ? ("bad" as const) : margin < target ? ("warn" as const) : ("good" as const),
  };
}
