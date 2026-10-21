import "server-only";
import type { Order, Prisma } from "@prisma/client";
import { lockStore, prisma, TX_OPTIONS } from "./db";
import { getSettings, updateSettings } from "./settings";
import { logAudit } from "./audit";
import { newOrderId } from "@/lib/ids";
import { addDays, nowIst } from "@/lib/time";
import { computeAvailability, type BookingLite } from "@/lib/availability";
import { deliveryFeeFor, effectivePrice, orderTotal, productCost } from "@/lib/pricing";
import {
  ACTIVE_STATUSES,
  ORDER_FLOW,
  type Availability,
  type HistoryEntry,
  type OrderStatus,
  type OrderView,
  type PaymentMethod,
} from "@/lib/types";
import type { placeOrderSchema } from "@/lib/validation";
import type { z } from "zod";

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
    paymentStatus: o.paymentStatus === "paid" ? "paid" : "pending",
    status: o.status as OrderStatus,
    history,
    issue: o.issueText ? { text: o.issueText, at: (o.issueAt ?? o.updatedAt).toISOString(), resolved: o.issueResolved } : null,
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

export async function getAvailability(): Promise<Availability> {
  const now = nowIst();
  const [settings, bookings] = await Promise.all([getSettings(), getBookings(prisma, now.date)]);
  return computeAvailability(settings, bookings, now);
}

export type PlaceOrderResult = { ok: true; order: OrderView } | { ok: false; error: string; field?: string };

/** Create an order after re-checking stock, slot capacity and the delivery area inside one transaction. */
export async function placeOrder(input: z.output<typeof placeOrderSchema>, customerId: string): Promise<PlaceOrderResult> {
  return prisma.$transaction(async (tx) => {
    await lockStore(tx);
    const now = nowIst();
    const settings = await getSettings(tx);
    const bookings = await getBookings(tx, now.date);
    const avail = computeAvailability(settings, bookings, now);

    if (!avail.status.open) return { ok: false, error: avail.status.text + ". " + avail.status.detail };
    if (settings.pincodes.length && !settings.pincodes.includes(input.pincode)) {
      return { ok: false, field: "pincode", error: `Sorry, we don't deliver to ${input.pincode} yet.` };
    }
    if (input.trays > settings.maxTrays) return { ok: false, field: "trays", error: `Maximum ${settings.maxTrays} trays per order.` };
    if (input.trays > avail.available) {
      return { ok: false, field: "trays", error: `Only ${avail.available} tray${avail.available === 1 ? "" : "s"} left today.` };
    }
    const day = avail.days.find((d) => d.date === input.date);
    const slot = day?.slots.find((s) => s.id === input.slotId);
    if (!day || !slot || !slot.ok) return { ok: false, field: "slot", error: "That delivery window just filled up. Pick another one." };
    if (input.payment === "cod" && !settings.codEnabled) return { ok: false, field: "payment", error: "Cash on delivery is not available right now." };
    if (input.payment === "upi" && !settings.upiOnDelivery) return { ok: false, field: "payment", error: "UPI on delivery is not available right now." };

    const ep = effectivePrice(settings, now.date);
    const fee = deliveryFeeFor(input.trays, settings.deliveryFee, settings.freeDeliveryFrom);
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
          unitPrice: ep.price,
          deliveryFee: fee,
          total: orderTotal(input.trays, ep.price, fee),
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
          historyJson: JSON.stringify(history),
        },
      });
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
    const row = await tx.order.update({ where: { id }, data: { status: ns, historyJson: pushHistory(o, ns, by) } });
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
  if (proof.customerId && o.customerId === proof.customerId) return true;
  if (proof.phone && o.phone === proof.phone) return true;
  return false;
}

/** Cancel an order. With `proof` it is a customer cancelling (only while "placed"); without, an admin. */
export async function cancelOrder(id: string, by: string, proof?: OwnerProof): Promise<OrderView> {
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
