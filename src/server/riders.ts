import "server-only";
import { cache } from "react";
import { randomInt } from "node:crypto";
import type { Order } from "@prisma/client";
import { lockStore, prisma, TX_OPTIONS } from "./db";
import { getUser } from "./customer-auth";
import { getSettings, updateSettings } from "./settings";
import { logAudit } from "./audit";
import { toOrderView } from "./orders";
import { nowIst } from "@/lib/time";
import type { HistoryEntry, OrderView } from "@/lib/types";

export type RiderView = { id: string; name: string; phone: string; active: boolean };

const toRider = (r: { id: string; name: string; phone: string; active: boolean }): RiderView => ({ id: r.id, name: r.name, phone: r.phone, active: r.active });

export async function listRiders(): Promise<RiderView[]> {
  return (await prisma.rider.findMany({ orderBy: { createdAt: "asc" } })).map(toRider);
}

export async function saveRider(input: { id?: string; name: string; phone: string; active: boolean }): Promise<RiderView> {
  const data = { name: input.name.trim(), phone: input.phone, active: input.active };
  const clash = await prisma.rider.findFirst({ where: { phone: data.phone, ...(input.id ? { NOT: { id: input.id } } : {}) } });
  if (clash) throw new Error(`${clash.name} already uses this mobile number.`);
  const row = input.id ? await prisma.rider.update({ where: { id: input.id }, data }) : await prisma.rider.create({ data });
  return toRider(row);
}

export async function deleteRider(id: string): Promise<void> {
  const busy = await prisma.order.count({ where: { riderId: id, status: "out" } });
  if (busy) throw new Error(`This rider has ${busy} order${busy === 1 ? "" : "s"} out for delivery. Mark them delivered or returned first.`);
  await prisma.rider.delete({ where: { id } });
}

/** The logged-in user's delivery-partner profile, if their mobile number belongs to an active rider. */
export const getRider = cache(async (): Promise<RiderView | null> => {
  const user = await getUser();
  if (!user?.phone) return null;
  const r = await prisma.rider.findUnique({ where: { phone: user.phone } });
  return r && r.active ? toRider(r) : null;
});

export async function requireRider(): Promise<RiderView> {
  const r = await getRider();
  if (!r) throw new Error("Only delivery partners can do this.");
  return r;
}

export function newDeliveryCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

function pushHistory(o: Order, status: HistoryEntry["status"], by: string): string {
  let h: HistoryEntry[] = [];
  try {
    h = JSON.parse(o.historyJson) as HistoryEntry[];
  } catch {
    h = [];
  }
  h.push({ status, at: new Date().toISOString(), by });
  return JSON.stringify(h);
}

const READY = ["placed", "confirmed", "packed"];

export type RiderBoard = {
  /** Today's (and overdue) orders nobody has taken out yet. */
  ready: OrderView[];
  /** Out for delivery with this rider. */
  mine: OrderView[];
  /** Delivered by this rider today. */
  done: OrderView[];
};

export async function riderBoard(rider: RiderView): Promise<RiderBoard> {
  const today = nowIst().date;
  const startOfDay = new Date(`${today}T00:00:00+05:30`);
  const [ready, mine, done] = await Promise.all([
    prisma.order.findMany({ where: { status: { in: READY }, date: { lte: today }, riderId: null }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.order.findMany({ where: { status: "out", riderId: rider.id }, orderBy: { updatedAt: "asc" } }),
    prisma.order.findMany({ where: { status: "delivered", riderId: rider.id, deliveredAt: { gte: startOfDay } }, orderBy: { deliveredAt: "desc" } }),
  ]);
  return { ready: ready.map(toOrderView), mine: mine.map(toOrderView), done: done.map(toOrderView) };
}

/** Take orders out for delivery. Orders someone else already took are skipped. */
export async function startRun(rider: RiderView, ids: string[]): Promise<{ started: number; skipped: number }> {
  const today = nowIst().date;
  return prisma.$transaction(async (tx) => {
    await lockStore(tx);
    let started = 0;
    for (const id of ids) {
      const o = await tx.order.findUnique({ where: { id } });
      if (!o || !READY.includes(o.status) || o.riderId || o.date > today) continue;
      await tx.order.update({
        where: { id },
        data: { status: "out", riderId: rider.id, deliveryCode: o.deliveryCode ?? newDeliveryCode(), deliveryCodeTries: 0, historyJson: pushHistory(o, "out", `rider ${rider.name}`) },
      });
      started++;
    }
    if (started) await logAudit(`rider ${rider.name}`, `Took ${started} order${started === 1 ? "" : "s"} out for delivery`, "", tx);
    return { started, skipped: ids.length - started };
  }, TX_OPTIONS);
}

export type DeliverResult = { ok: true; order: OrderView } | { ok: false; error: string; field?: "code" | "cash" };

/**
 * Hand over an order. Paid online: the customer's 4-digit delivery code is
 * required (5 tries). Cash/UPI on delivery: the rider confirms the money was
 * collected, which also marks the order paid.
 */
export async function deliver(rider: RiderView, id: string, proof: { code?: string; cashCollected?: boolean }): Promise<DeliverResult> {
  return prisma.$transaction(async (tx) => {
    await lockStore(tx);
    const o = await tx.order.findUnique({ where: { id } });
    if (!o || o.status !== "out" || o.riderId !== rider.id) return { ok: false, error: "This order isn't out for delivery with you." };
    const paidOnline = o.payment === "online" && o.paymentStatus === "paid";
    if (paidOnline) {
      if (o.deliveryCodeTries >= 5) return { ok: false, field: "code", error: "Too many wrong codes. Ask the customer to call the store." };
      const code = (proof.code ?? "").replace(/\D/g, "");
      if (!o.deliveryCode || code !== o.deliveryCode) {
        await tx.order.update({ where: { id }, data: { deliveryCodeTries: { increment: 1 } } });
        const left = 4 - o.deliveryCodeTries;
        return { ok: false, field: "code", error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Ask the customer to call the store." };
      }
    } else if (!proof.cashCollected) {
      return { ok: false, field: "cash", error: `Collect ₹${o.total} before marking it delivered.` };
    }
    const row = await tx.order.update({
      where: { id },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
        ...(paidOnline ? {} : { paymentStatus: "paid" }),
        historyJson: pushHistory(o, "delivered", `rider ${rider.name}`),
      },
    });
    const s = await getSettings(tx);
    await updateSettings({ stock: Math.max(0, s.stock - o.trays) }, tx);
    await logAudit(`rider ${rider.name}`, `Delivered ${id}`, paidOnline ? "delivery code checked" : `collected ₹${o.total}`, tx);
    return { ok: true, order: toOrderView(row) };
  }, TX_OPTIONS);
}

/** Couldn't deliver (customer away, wrong address…): back to the ready list for later. */
export async function returnOrder(rider: RiderView, id: string, reason: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockStore(tx);
    const o = await tx.order.findUnique({ where: { id } });
    if (!o || o.status !== "out" || o.riderId !== rider.id) throw new Error("This order isn't out for delivery with you.");
    await tx.order.update({ where: { id }, data: { status: "packed", riderId: null, historyJson: pushHistory(o, "packed", `rider ${rider.name}: not delivered`) } });
    await logAudit(`rider ${rider.name}`, `Couldn't deliver ${id}`, reason.slice(0, 200), tx);
  }, TX_OPTIONS);
}
