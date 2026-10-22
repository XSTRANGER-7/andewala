import "server-only";
import { cache } from "react";
import type { Order, Prisma } from "@prisma/client";
import { lockStore, prisma, TX_OPTIONS } from "./db";
import { getSettings, updateSettings } from "./settings";
import { logAudit } from "./audit";
import { razorpayEnabled, refundPayment } from "./razorpay";
import { getActiveZones, listZones } from "./zones";
import { coverageAt, isCovered, type Zone } from "@/lib/zones";
import { newOrderId } from "@/lib/ids";
import { addDays, nowIst } from "@/lib/time";
import { computeAvailability, type BookingLite } from "@/lib/availability";
import { deliveryFeeFor, effectivePrice, orderTotal, productCost } from "@/lib/pricing";
import {
  ACTIVE_STATUSES,
  ORDER_FLOW,
  type Availability,
  type StoreSettings,
  type HistoryEntry,
  type OrderStatus,
  type OrderView,
  type PaymentMethod,
} from "@/lib/types";
import type { placeOrderSchema } from "@/lib/validation";
import type { z } from "zod";
import { randomInt } from "node:crypto";

type Tx = Prisma.TransactionClient;

export function toOrderView(o: Order): OrderView {
  let history: HistoryEntry[] = [];
  try {
    history = JSON.parse(o.historyJson) as HistoryEntry[];
  } catch {
    history = [];
  }
  return {
    id: o.id,
    customerId: o.customerId,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    date: o.date,
    slotId: o.slotId,
    slotLabel: o.slotLabel,
    trays: o.trays,
    unitPrice: o.unitPrice,
    deliveryFee: o.deliveryFee,
    total: o.total,
    productCost: o.productCost,
    deliveryCost: o.deliveryCost,
    customer: { name: o.name, phone: o.phone, address: o.address, landmark: o.landmark, pincode: o.pincode, lat: o.lat, lng: o.lng },
    notes: o.notes,
    payment: o.payment as PaymentMethod,
    paymentStatus: o.paymentStatus === "paid" ? "paid" : o.paymentStatus === "refunded" ? "refunded" : "pending",
    status: o.status as OrderStatus,
    history,
    issue: o.issueText ? { text: o.issueText, at: (o.issueAt ?? o.updatedAt).toISOString(), resolved: o.issueResolved } : null,
    riderId: o.riderId,
    deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
    runSeq: o.runSeq,
  };
}

/** Open orders that count against stock, plus upcoming ones that count against slot capacity. */
export async function getBookings(tx: Tx = prisma, today = nowIst().date): Promise<BookingLite[]> {
  const rows = await tx.order.findMany({
    where: {
      OR: [{ status: { in: ACTIVE_STATUSES } }, { date: { gte: addDays(today, -1) }, status: { not: "cancelled" } }],
    },
    select: { date: true, slotId: true, trays: true, status: true },
  });
  return rows.map((r) => ({ ...r, status: r.status as OrderStatus }));
}

/** Live availability, computed once per request and shared by the page and its shell. */
export const getAvailability = cache(async (): Promise<Availability> => {
  const now = nowIst();
  const [settings, bookings] = await Promise.all([getSettings(), getBookings(prisma, now.date)]);
  const [a, zones] = [computeAvailability(settings, bookings, now), await getActiveZones()];
  // Online payment needs the Razorpay keys as well as the admin switch.
  return { ...a, zones, payments: { ...a.payments, online: a.payments.online && razorpayEnabled() } };
});

export type PlaceOrderResult = { ok: true; order: OrderView } | { ok: false; error: string; field?: string };
type OrderInput = z.output<typeof placeOrderSchema>;
type Checked = { ok: true; slot: { id: string; label: string }; price: number; fee: number; total: number; zone: string | null } | { ok: false; error: string; field?: string };

/** Everything an order must pass: store open, area, stock, window, payment option. Shared by pricing and placing. */
function checkOrder(settings: StoreSettings, avail: Availability, input: OrderInput, paidOnline: boolean, zones: Zone[]): Checked {
    if (!avail.status.open) return { ok: false, error: avail.status.text + ". " + avail.status.detail };
    const covered = isCovered({ zones, pincodes: settings.pincodes }, input);
    if (covered === false) return { ok: false, field: "pincode", error: zones.length ? "Sorry, this address is outside our delivery area." : `Sorry, we don't deliver to ${input.pincode} yet.` };
    if (covered === null) return { ok: false, field: "pincode", error: "Drop a pin on the map for this address so we can check we deliver there." };
    if (input.trays > settings.maxTrays) return { ok: false, field: "trays", error: `Maximum ${settings.maxTrays} trays per order.` };
    if (input.trays > avail.available) {
      return { ok: false, field: "trays", error: `Only ${avail.available} tray${avail.available === 1 ? "" : "s"} left today.` };
    }
    const day = avail.days.find((d) => d.date === input.date);
    const slot = day?.slots.find((s) => s.id === input.slotId);
    if (!day || !slot || !slot.ok) return { ok: false, field: "slot", error: "That delivery window just filled up. Pick another one." };
    if (input.payment === "cod" && !settings.codEnabled) return { ok: false, field: "payment", error: "Cash on delivery is not available right now." };
    // A payment already taken is honoured even if the admin has just switched online payment off.
    if (input.payment === "online" && !paidOnline && !(settings.onlineEnabled && razorpayEnabled())) {
      return { ok: false, field: "payment", error: "Online payment is not available right now." };
    }
    const ep = effectivePrice(settings, avail.today);
    const fee = deliveryFeeFor(input.trays, settings.deliveryFee, settings.freeDeliveryFrom);
    const at = coverageAt({ zones, pincodes: settings.pincodes }, input);
    const zone = at.status === "inside" ? (at.zone?.name ?? null) : at.status === "near" ? `${at.zone.name} (just outside, ${at.distanceM} m)` : null;
    return { ok: true, slot: { id: slot.id, label: slot.label }, price: ep.price, fee, total: orderTotal(input.trays, ep.price, fee), zone };
}

/** Price an order without placing it (used before taking an online payment). */
export async function quoteOrder(input: OrderInput): Promise<Checked> {
  const now = nowIst();
  const [settings, bookings, zones] = await Promise.all([getSettings(), getBookings(prisma, now.date), getActiveZones()]);
  return checkOrder(settings, computeAvailability(settings, bookings, now), input, false, zones);
}

/** Online payment details to attach when placing an order that has been paid. */
export type PaidWith = { attemptId: string; razorpayOrderId: string; razorpayPaymentId: string; price: number; fee: number };

/**
 * Create an order after re-checking stock, slot capacity and the delivery area
 * inside one transaction. With `paid`, the order is for a payment attempt:
 * if that attempt already produced an order (the browser and the webhook both
 * finishing it), the existing order is returned instead of a second one.
 */
export async function placeOrder(input: OrderInput, customerId: string, paid?: PaidWith): Promise<PlaceOrderResult> {
  return prisma.$transaction(async (tx) => {
    await lockStore(tx);
    if (paid) {
      const att = await tx.paymentAttempt.findUnique({ where: { id: paid.attemptId } });
      if (att?.orderId) {
        const existing = await tx.order.findUnique({ where: { id: att.orderId } });
        if (existing) return { ok: true, order: toOrderView(existing) };
      }
    }
    const now = nowIst();
    const settings = await getSettings(tx);
    const bookings = await getBookings(tx, now.date);
    const avail = computeAvailability(settings, bookings, now);
    const zones = (await listZones(tx)).filter((z) => z.active);
    const checked = checkOrder(settings, avail, input, !!paid, zones);
    if (!checked.ok) return checked;
    const { slot } = checked;
    // A paid order keeps the price the customer paid, even if the price changed a moment later.
    const price = paid ? paid.price : checked.price;
    const fee = paid ? paid.fee : checked.fee;
    const total = orderTotal(input.trays, price, fee);
    const at = new Date().toISOString();
    const history: HistoryEntry[] = [{ status: "placed", at, by: "customer" }];

    // Retry the id on the (very unlikely) collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = newOrderId(input.date);
      const exists = await tx.order.findUnique({ where: { id }, select: { id: true } });
      if (exists) continue;
      const row = await tx.order.create({
        data: {
          id,
          customerId,
          date: input.date,
          slotId: slot.id,
          slotLabel: slot.label,
          trays: input.trays,
          unitPrice: price,
          deliveryFee: fee,
          total,
          productCost: productCost(settings.costs),
          deliveryCost: settings.costs.delivery,
          name: input.name,
          phone: input.phone,
          address: input.address,
          landmark: input.landmark,
          pincode: input.pincode,
          lat: input.lat,
          lng: input.lng,
          notes: input.notes,
          payment: input.payment,
          deliveryZone: checked.zone,
          deliveryCode: String(randomInt(0, 10_000)).padStart(4, "0"),
          ...(paid ? { paymentStatus: "paid", razorpayOrderId: paid.razorpayOrderId, razorpayPaymentId: paid.razorpayPaymentId } : {}),
          historyJson: JSON.stringify(history),
        },
      });
      if (paid) {
        await tx.paymentAttempt.update({ where: { id: paid.attemptId }, data: { status: "paid", orderId: row.id, razorpayPaymentId: paid.razorpayPaymentId, error: null } });
      }
      return { ok: true, order: toOrderView(row) };
    }
    return { ok: false, error: "Could not create an order id. Please try again." };
  }, TX_OPTIONS);
}

export async function getOrder(id: string): Promise<OrderView | null> {
  const row = await prisma.order.findUnique({ where: { id: id.toUpperCase() } });
  return row ? toOrderView(row) : null;
}

/** How many of the customer's orders are still on their way (for the header badge). */
export async function countActiveOrders(customerId: string): Promise<number> {
  return prisma.order.count({ where: { customerId, status: { in: ACTIVE_STATUSES } } });
}

export async function listCustomerOrders(customerId: string): Promise<OrderView[]> {
  const rows = await prisma.order.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map(toOrderView);
}

export type AdminOrderFilter = { date: "today" | "tomorrow" | "upcoming" | "all"; status: "active" | "issues" | "delivered" | "cancelled" | "all" };

export async function listOrdersForAdmin(filter: AdminOrderFilter, today = nowIst().date): Promise<OrderView[]> {
  const where: Prisma.OrderWhereInput = {};
  if (filter.date === "today") where.date = today;
  else if (filter.date === "tomorrow") where.date = addDays(today, 1);
  else if (filter.date === "upcoming") where.date = { gte: today };
  if (filter.status === "active") where.status = { in: ACTIVE_STATUSES };
  else if (filter.status === "issues") Object.assign(where, { issueText: { not: null }, issueResolved: false });
  else if (filter.status !== "all") where.status = filter.status;
  const rows = await prisma.order.findMany({ where, orderBy: [{ date: "asc" }, { slotId: "asc" }, { createdAt: "asc" }], take: 500 });
  return rows.map(toOrderView);
}

/** Orders for the last `days` days plus upcoming, for the admin overview. */
export async function listRecentOrders(days = 7, today = nowIst().date): Promise<OrderView[]> {
  const rows = await prisma.order.findMany({ where: { date: { gte: addDays(today, -(days - 1)) } }, orderBy: { createdAt: "asc" }, take: 2000 });
  return rows.map(toOrderView);
}

function pushHistory(o: Order, status: OrderStatus, by: string): string {
  let history: HistoryEntry[] = [];
  try {
    history = JSON.parse(o.historyJson) as HistoryEntry[];
  } catch {
    history = [];
  }
  history.push({ status, at: new Date().toISOString(), by });
  return JSON.stringify(history);
}

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(s as (typeof ORDER_FLOW)[number]);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
}

/** Admin: move an order one step along the flow. Delivering reduces stock on hand. */
export async function advanceOrder(id: string, by: string): Promise<OrderView> {
  return prisma.$transaction(async (tx) => {
    await lockStore(tx);
    const o = await tx.order.findUniqueOrThrow({ where: { id } });
    const ns = nextStatus(o.status as OrderStatus);
    if (!ns || o.status === "cancelled") throw new Error("This order cannot move further.");
    const row = await tx.order.update({ where: { id }, data: { status: ns, historyJson: pushHistory(o, ns, by), ...(ns === "delivered" ? { deliveredAt: new Date() } : {}) } });
    if (ns === "delivered") {
      const s = await getSettings(tx);
      await updateSettings({ stock: Math.max(0, s.stock - o.trays) }, tx);
    }
    await logAudit(by, `Order ${id} → ${ns}`, ns === "delivered" ? `${o.trays} trays left stock` : "", tx);
    return toOrderView(row);
  }, TX_OPTIONS);
}

/** How a customer proves an order is theirs: the device cookie, or the phone number they ordered with. */
export type OwnerProof = { customerId: string | null; phone?: string };

function ownedBy(o: Order, proof: OwnerProof): boolean {
  // Orders belong to the logged-in account that placed them; a phone number alone is not proof.
  return !!proof.customerId && o.customerId === proof.customerId;
}

/** Cancel an order. With `proof` it is a customer cancelling (only while "placed"); without, an admin. Paid online orders are refunded. */
export async function cancelOrder(id: string, by: string, proof?: OwnerProof): Promise<OrderView> {
  const cancelled = await cancelInDb(id, by, proof);
  if (cancelled.payment !== "online" || cancelled.paymentStatus !== "paid") return cancelled;
  const o = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (!o.razorpayPaymentId) return cancelled;
  try {
    await refundPayment(o.razorpayPaymentId, o.total * 100, { order: id, reason: "cancelled" });
    const row = await prisma.order.update({ where: { id }, data: { paymentStatus: "refunded" } });
    await logAudit(by, `Refunded ${id}`, `₹${o.total} back to the customer (order cancelled)`);
    return toOrderView(row);
  } catch (e) {
    console.error("refund failed", id, e);
    await logAudit("system", `Refund failed for ${id}`, `₹${o.total}. Refund it from the Razorpay dashboard. ${e instanceof Error ? e.message : ""}`);
    return cancelled;
  }
}

async function cancelInDb(id: string, by: string, proof?: OwnerProof): Promise<OrderView> {
  return prisma.$transaction(async (tx) => {
    await lockStore(tx);
    const o = await tx.order.findUniqueOrThrow({ where: { id } });
    if (proof) {
      if (!ownedBy(o, proof)) throw new Error("This order belongs to someone else.");
      if (o.status !== "placed") throw new Error("This order is already being prepared and can't be cancelled online.");
    } else if (!ACTIVE_STATUSES.includes(o.status as OrderStatus)) {
      throw new Error("Only open orders can be cancelled.");
    }
    const row = await tx.order.update({ where: { id }, data: { status: "cancelled", historyJson: pushHistory(o, "cancelled", by) } });
    if (!proof) await logAudit(by, `Cancelled order ${id}`, "", tx);
    return toOrderView(row);
  }, TX_OPTIONS);
}

export async function markPaid(id: string, by: string): Promise<OrderView> {
  const row = await prisma.order.update({ where: { id }, data: { paymentStatus: "paid" } });
  await logAudit(by, `Order ${id} marked paid`, `₹${row.total}`);
  return toOrderView(row);
}

export async function reportIssue(id: string, proof: OwnerProof, text: string): Promise<OrderView> {
  const o = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (!ownedBy(o, proof)) throw new Error("This order belongs to someone else.");
  if (o.status !== "delivered") throw new Error("You can report a problem once the order is delivered.");
  const row = await prisma.order.update({ where: { id }, data: { issueText: text, issueAt: new Date(), issueResolved: false } });
  return toOrderView(row);
}

export async function resolveIssue(id: string, by: string): Promise<OrderView> {
  const row = await prisma.order.update({ where: { id }, data: { issueResolved: true } });
  await logAudit(by, `Resolved report on ${id}`, row.issueText ?? "");
  return toOrderView(row);
}

/** For the customer's own order page: the code to give the rider, and who is bringing it. */
export async function getDeliveryInfo(id: string): Promise<{ code: string | null; rider: { name: string; phone: string } | null }> {
  const o = await prisma.order.findUnique({ where: { id }, select: { deliveryCode: true, riderId: true } });
  if (!o) return { code: null, rider: null };
  const r = o.riderId ? await prisma.rider.findUnique({ where: { id: o.riderId }, select: { name: true, phone: true } }) : null;
  return { code: o.deliveryCode, rider: r };
}
