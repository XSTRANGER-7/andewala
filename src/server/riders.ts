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
  const busy = await prisma.order.count({ where: { riderId: id, OR: [{ status: "out" }, { status: "packed", runSeq: { not: null } }] } });
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
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type RiderBoard = {
  /** Today's (and overdue) orders nobody has taken yet. */
  ready: OrderView[];
  /** This rider's run in delivery order: the current stop ("out") first, then the ones waiting. */
  run: OrderView[];
  /** Delivered by this rider today. */
  done: OrderView[];
};

export async function riderBoard(rider: RiderView): Promise<RiderBoard> {
  const today = nowIst().date;
  const startOfDay = new Date(`${today}T00:00:00+05:30`);
  const [ready, run, done] = await Promise.all([
    prisma.order.findMany({ where: { status: { in: READY }, date: { lte: today }, riderId: null }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.order.findMany({ where: { riderId: rider.id, OR: [{ status: "out" }, { status: "packed", runSeq: { not: null } }] } }),
    prisma.order.findMany({ where: { status: "delivered", riderId: rider.id, deliveredAt: { gte: startOfDay } }, orderBy: { deliveredAt: "desc" } }),
  ]);
  // current stop first, then by place in the run
  run.sort((a, b) => (a.status === "out" ? -1 : b.status === "out" ? 1 : (a.runSeq ?? 999) - (b.runSeq ?? 999)));
  return { ready: ready.map(toOrderView), run: run.map(toOrderView), done: done.map(toOrderView) };
}

/**
 * Put the rider's waiting stops in `order` (ids not in the run are ignored,
 * stops left out keep their place after the listed ones) and, if no stop is
 * out right now, send the first one out: that customer sees "Out for
 * delivery" and their delivery code. A stop already out stays the current one.
 */
async function arrangeRun(tx: Tx, rider: RiderView, order: string[] = []): Promise<string | null> {
  const run = await tx.order.findMany({ where: { riderId: rider.id, OR: [{ status: "out" }, { status: "packed", runSeq: { not: null } }] } });
  const waiting = run.filter((o) => o.status === "packed").sort((a, b) => (a.runSeq ?? 999) - (b.runSeq ?? 999));
  const listed = order.map((id) => waiting.find((o) => o.id === id)).filter((o): o is Order => !!o);
  const rest = waiting.filter((o) => !listed.includes(o));
  const sequence = [...listed, ...rest];
  const current = run.find((o) => o.status === "out");
  // The stop that goes out next (when none is out) is #1; the waiting ones follow as 2, 3, …
  const next = current ? null : (sequence[0] ?? null);
  const waitingAfter = next ? sequence.slice(1) : sequence;
  for (const [i, o] of waitingAfter.entries()) if (o.runSeq !== i + 2) await tx.order.update({ where: { id: o.id }, data: { runSeq: i + 2 } });
  if (current) return current.id;
  if (!next) return null;
  await tx.order.update({
    where: { id: next.id },
    data: { status: "out", runSeq: 1, deliveryCode: next.deliveryCode ?? newDeliveryCode(), deliveryCodeTries: 0, historyJson: pushHistory(next, "out", `rider ${rider.name}`) },
  });
  return next.id;
}

/**
 * Start a delivery run with the stops in the given order (best first). Orders
 * another rider took in the meantime are skipped. Only the first stop goes
 * out for delivery; the others wait in the run until their turn.
 */
export async function startRun(rider: RiderView, ids: string[]): Promise<{ started: number; skipped: number; current: string | null }> {
  const today = nowIst().date;
  return prisma.$transaction(async (tx) => {
    await lockStore(tx);
    const claimed: string[] = [];
    for (const id of ids) {
      const o = await tx.order.findUnique({ where: { id } });
      if (!o || !READY.includes(o.status) || o.riderId || o.date > today) continue;
      await tx.order.update({ where: { id }, data: { status: "packed", riderId: rider.id, runSeq: 100 + claimed.length } });
      claimed.push(id);
    }
    const current = claimed.length ? await arrangeRun(tx, rider, claimed) : null;
    if (claimed.length) await logAudit(`rider ${rider.name}`, `Started a delivery run of ${claimed.length} order${claimed.length === 1 ? "" : "s"}`, claimed.join(", "), tx);
    return { started: claimed.length, skipped: ids.length - claimed.length, current };
  }, TX_OPTIONS);
}

/** Re-order the waiting stops (e.g. after re-planning from where the rider is). */
export async function reorderRun(rider: RiderView, ids: string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockStore(tx);
    await arrangeRun(tx, rider, ids);
  }, TX_OPTIONS);
}

export type DeliverResult = { ok: true; order: OrderView; next: string | null } | { ok: false; error: string; field?: "code" | "cash" };

/**
 * Hand over the current stop. Every order needs the customer's 4-digit
 * delivery code (5 tries); pay-on-delivery orders also need "cash collected",
 * which marks them paid. Then the next stop (in `nextOrder`, re-planned from
 * here) goes out for delivery.
 */
export async function deliver(rider: RiderView, id: string, proof: { code?: string; cashCollected?: boolean }, nextOrder: string[] = []): Promise<DeliverResult> {
  return prisma.$transaction(async (tx) => {
    await lockStore(tx);
    const o = await tx.order.findUnique({ where: { id } });
    if (!o || o.status !== "out" || o.riderId !== rider.id) return { ok: false, error: "This order isn't out for delivery with you." };
    const paid = o.paymentStatus === "paid";
    if (o.deliveryCodeTries >= 5) return { ok: false, field: "code", error: "Too many wrong codes. Ask the customer to call the store." };
    const code = (proof.code ?? "").replace(/\D/g, "");
    if (!o.deliveryCode || code !== o.deliveryCode) {
      await tx.order.update({ where: { id }, data: { deliveryCodeTries: { increment: 1 } } });
      const left = 4 - o.deliveryCodeTries;
      return { ok: false, field: "code", error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Ask the customer to call the store." };
    }
    if (!paid && !proof.cashCollected) return { ok: false, field: "cash", error: `Collect ₹${o.total} before marking it delivered.` };
    const row = await tx.order.update({
      where: { id },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
        runSeq: null,
        ...(paid ? {} : { paymentStatus: "paid" }),
        historyJson: pushHistory(o, "delivered", `rider ${rider.name}`),
      },
    });
    const s = await getSettings(tx);
    await updateSettings({ stock: Math.max(0, s.stock - o.trays) }, tx);
    await logAudit(`rider ${rider.name}`, `Delivered ${id}`, paid ? "delivery code checked" : `code checked, collected ₹${o.total}`, tx);
    const next = await arrangeRun(tx, rider, nextOrder);
    return { ok: true, order: toOrderView(row), next };
  }, TX_OPTIONS);
}

/** Couldn't deliver (customer away, wrong address…): back to the ready list; the next stop goes out. */
export async function returnOrder(rider: RiderView, id: string, reason: string, nextOrder: string[] = []): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    await lockStore(tx);
    const o = await tx.order.findUnique({ where: { id } });
    if (!o || o.riderId !== rider.id || !(o.status === "out" || o.status === "packed")) throw new Error("This order isn't in your delivery run.");
    await tx.order.update({ where: { id }, data: { status: "packed", riderId: null, runSeq: null, historyJson: o.status === "out" ? pushHistory(o, "packed", `rider ${rider.name}: not delivered`) : o.historyJson } });
    await logAudit(`rider ${rider.name}`, `Couldn't deliver ${id}`, reason.slice(0, 200), tx);
    return arrangeRun(tx, rider, nextOrder);
  }, TX_OPTIONS);
}
