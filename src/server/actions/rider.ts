"use server";

import { revalidatePath } from "next/cache";
import * as riders from "@/server/riders";

export type RiderResult = { ok: true; message: string } | { ok: false; error: string; field?: "code" | "cash" };

function refresh(ids: string[] = []) {
  for (const p of ["/rider", "/admin", "/admin/orders", "/orders", "/account"]) revalidatePath(p);
  for (const id of ids) revalidatePath(`/order/${id}`);
}

const cleanIds = (ids: unknown): string[] => (Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string" && x.length < 40).slice(0, 50) : []);

/** Take the chosen orders out for delivery. */
export async function startRunAction(ids: string[]): Promise<RiderResult> {
  try {
    const rider = await riders.requireRider();
    const list = cleanIds(ids);
    if (!list.length) return { ok: false, error: "Choose at least one order." };
    const r = await riders.startRun(rider, list);
    refresh(list);
    if (!r.started) return { ok: false, error: "Those orders were already taken by another rider or changed. The list has been refreshed." };
    return { ok: true, message: `Run started: ${r.started} stop${r.started === 1 ? "" : "s"}${r.skipped ? ` (${r.skipped} already taken)` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "That didn't work. Try again." };
  }
}

/** Mark an order delivered: delivery code for orders paid online, cash confirmation otherwise. */
export async function deliverAction(id: string, proof: { code?: string; cashCollected?: boolean }, nextOrder: string[] = []): Promise<RiderResult> {
  try {
    const rider = await riders.requireRider();
    if (typeof id !== "string") return { ok: false, error: "Unknown order." };
    const r = await riders.deliver(rider, id, { code: typeof proof?.code === "string" ? proof.code.slice(0, 8) : undefined, cashCollected: proof?.cashCollected === true }, cleanIds(nextOrder));
    if (!r.ok) return { ok: false, error: r.error, field: r.field };
    refresh([id, ...(r.next ? [r.next] : [])]);
    return { ok: true, message: `${id} delivered${r.next ? ". Next stop is ready." : ". Run complete!"}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "That didn't work. Try again." };
  }
}

/** Couldn't deliver: put the order back in the ready list. */
export async function returnOrderAction(id: string, reason: string, nextOrder: string[] = []): Promise<RiderResult> {
  try {
    const rider = await riders.requireRider();
    const next = await riders.returnOrder(rider, String(id), String(reason ?? "").trim() || "No reason given", cleanIds(nextOrder));
    refresh([id, ...(next ? [next] : [])]);
    return { ok: true, message: "Order moved back to the ready list" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "That didn't work. Try again." };
  }
}

/** Re-order the waiting stops after re-planning from the rider's position. */
export async function reorderRunAction(ids: string[]): Promise<RiderResult> {
  try {
    const rider = await riders.requireRider();
    await riders.reorderRun(rider, cleanIds(ids));
    refresh();
    return { ok: true, message: "Route updated" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "That didn't work. Try again." };
  }
}
