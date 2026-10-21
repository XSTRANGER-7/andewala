import { ACTIVE_STATUSES } from "./types";
import type { Availability, DayAvailability, OrderStatus, ShopStatus, SlotAvailability, StoreSettings } from "./types";
import { addDays, fmtDay, fmtTime, nowIst, relativeDay, toMinutes, type IstNow } from "./time";
import { effectivePrice } from "./pricing";

/** The minimum an open order needs to count against stock and slot capacity. */
export type BookingLite = { date: string; slotId: string; trays: number; status: OrderStatus };

/** Minutes before a window starts after which same-day orders for it close. */
export const SLOT_LEAD_MINUTES = 30;

export function reservedTrays(bookings: BookingLite[]): number {
  return bookings.filter((b) => ACTIVE_STATUSES.includes(b.status)).reduce((a, b) => a + b.trays, 0);
}

export function availableTrays(s: StoreSettings, bookings: BookingLite[]): number {
  return Math.max(0, s.stock - reservedTrays(bookings));
}

export function slotOrders(bookings: BookingLite[], date: string, slotId: string): number {
  return bookings.filter((b) => b.date === date && b.slotId === slotId && b.status !== "cancelled").length;
}

export function deliveryDates(s: StoreSettings, now: IstNow): string[] {
  const out: string[] = [];
  if (now.minutes < toMinutes(s.cutoff)) out.push(now.date);
  for (let i = 1; i <= Math.max(1, s.daysAhead); i++) out.push(addDays(now.date, i));
  return out;
}

export function slotsFor(s: StoreSettings, bookings: BookingLite[], date: string, now: IstNow): SlotAvailability[] {
  return s.slots.map((slot) => {
    const used = slotOrders(bookings, date, slot.id);
    const left = Math.max(0, slot.capacity - used);
    const late =
      date === now.date &&
      (now.minutes >= toMinutes(s.cutoff) || now.minutes >= toMinutes(slot.start) - SLOT_LEAD_MINUTES);
    const pastDeadline = toMinutes(slot.end) > toMinutes(s.deadline);
    const ok = left > 0 && !late && !pastDeadline;
    return { ...slot, left, ok, reason: ok ? "" : left <= 0 ? "full" : "closed" };
  });
}

/**
 * Is the store taking orders right now, and if not, why. In order:
 * the admin's manual Closed, the daily hours (auto mode), the admin's Out of
 * stock switch, then trays actually left. The admin's manual Open skips the hours.
 */
export function shopStatus(s: StoreSettings, available: number, now: IstNow): ShopStatus {
  const opens = fmtTime(s.openTime);
  const closed = (reason: ShopStatus["reason"], text: string, detail: string, board: { title: string; sub: string }): ShopStatus => ({
    open: false,
    sameDay: false,
    reason,
    tone: "bad",
    text,
    detail,
    board,
  });
  if (s.storeMode === "closed") {
    return closed("closed", "Store closed", "We're not taking orders right now. Please check back soon.", { title: "Closed", sub: "Back soon" });
  }
  if (s.storeMode === "auto") {
    if (now.minutes < toMinutes(s.openTime)) {
      return closed("before_hours", `Opens at ${opens}`, `The store opens at ${opens} today. Order then for same-day delivery.`, { title: "Closed", sub: `Opens ${opens}` });
    }
    if (now.minutes >= toMinutes(s.cutoff)) {
      return closed("after_hours", "Closed for today", `Orders close at ${fmtTime(s.cutoff)}. We open again tomorrow at ${opens}.`, { title: "Closed", sub: `Opens ${opens} tomorrow` });
    }
  }
  if (s.outOfStock) {
    return closed("out_of_stock", "Out of stock", "We've run out of eggs for now. Fresh trays arrive after the next farm pickup.", { title: "Out of stock", sub: "Back soon" });
  }
  if (available <= 0) {
    return closed("sold_out", "Sold out", "Today's stock is fully booked. New stock is added after the next farm pickup.", { title: "Sold out", sub: "Back soon" });
  }
  const left = toMinutes(s.cutoff) - now.minutes;
  if (left > 0) {
    const h = Math.floor(left / 60);
    const m = left % 60;
    return {
      open: true,
      sameDay: true,
      reason: "open",
      board: null,
      tone: "good",
      text: "Same-day delivery open",
      detail: `Order in the next ${h ? h + "h " : ""}${m}m for delivery by ${fmtTime(s.deadline)} today.`,
    };
  }
  return {
    open: true,
    sameDay: false,
    reason: "open",
    board: null,
    tone: "warn",
    text: "Today's orders are closed",
    detail: `Same-day orders close at ${fmtTime(s.cutoff)}. Next delivery: ${fmtDay(addDays(now.date, 1))}.`,
  };
}

/** The full availability snapshot the order form renders from. */
export function computeAvailability(s: StoreSettings, bookings: BookingLite[], now: IstNow = nowIst()): Availability {
  const available = availableTrays(s, bookings);
  const ep = effectivePrice(s, now.date);
  const days: DayAvailability[] = deliveryDates(s, now).map((date) => {
    const slots = slotsFor(s, bookings, date, now);
    return { date, label: relativeDay(date, now.date), long: fmtDay(date), slots, open: slots.some((x) => x.ok) };
  });
  return {
    today: now.date,
    price: ep.price,
    priceSince: ep.since,
    available,
    maxTrays: Math.max(1, Math.min(s.maxTrays, available || 1)),
    status: shopStatus(s, available, now),
    days,
    deliveryFee: s.deliveryFee,
    freeDeliveryFrom: s.freeDeliveryFrom,
    pincodes: s.pincodes,
    areaName: s.areaName,
    cutoff: s.cutoff,
    deadline: s.deadline,
    payments: { cod: s.codEnabled, online: s.onlineEnabled },
    storeName: s.storeName,
  };
}
