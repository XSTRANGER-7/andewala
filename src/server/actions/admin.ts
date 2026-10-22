"use server";

import type { StoreMode } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/session";
import { getSettings, updateSettings } from "@/server/settings";
import { logAudit } from "@/server/audit";
import * as orders from "@/server/orders";
import { inr } from "@/lib/money";
import { fmtDay, fmtTime, nowIst } from "@/lib/time";
import { fullCost } from "@/lib/pricing";
import {
  fieldErrors,
  pricingSchema,
  scheduleSchema,
  settingsSchema,
  stockAddSchema,
  stockSetSchema,
  type SettingsInput,
} from "@/lib/validation";
import type { z } from "zod";
import * as zones from "@/server/zones";
import type { Zone } from "@/lib/zones";
import { zoneSchema, type ZoneFormInput } from "@/lib/validation";
import * as riders from "@/server/riders";
import { riderSchema, type RiderInput } from "@/lib/validation";

export type AdminResult<T = undefined> = { ok: true; message: string; data?: T } | { ok: false; errors: Record<string, string> };

function fail(e: unknown): AdminResult {
  return { ok: false, errors: { form: e instanceof Error ? e.message : "That didn't save. Try again." } };
}

function refreshAll() {
  for (const p of ["/", "/cart", "/orders", "/admin", "/admin/orders", "/admin/pricing", "/admin/settings", "/admin/areas", "/admin/activity", "/account/addresses"]) {
    revalidatePath(p);
  }
}

export async function savePricingAction(input: z.input<typeof pricingSchema>): Promise<AdminResult> {
  const parsed = pricingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const admin = await requireAdmin();
    const before = await getSettings();
    const { price, costs } = parsed.data;
    const changed = price !== before.price;
    const today = nowIst().date;
    await updateSettings({
      price,
      priceUpdatedAt: changed ? new Date() : before.priceUpdatedAt,
      costFarm: costs.farm,
      costInbound: costs.inbound,
      costPackaging: costs.packaging,
      costPayment: costs.payment,
      costDelivery: costs.delivery,
      // A scheduled price that has already gone live is superseded by this manual change.
      ...(before.scheduled && before.scheduled.date <= today ? { scheduledDate: null, scheduledPrice: null } : {}),
    });
    await logAudit(admin.name, changed ? `Price ${inr(before.price)} → ${inr(price)}` : "Updated costs", `cost/tray ${inr(fullCost(costs))}`);
    refreshAll();
    return { ok: true, message: "Price saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function schedulePriceAction(input: z.input<typeof scheduleSchema>): Promise<AdminResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const admin = await requireAdmin();
    if (parsed.data.date <= nowIst().date) return { ok: false, errors: { date: "Pick a date from tomorrow onwards." } };
    await updateSettings({ scheduledDate: parsed.data.date, scheduledPrice: parsed.data.price });
    await logAudit(admin.name, `Scheduled ${inr(parsed.data.price)} from ${fmtDay(parsed.data.date)}`);
    refreshAll();
    return { ok: true, message: "Price scheduled" };
  } catch (e) {
    return fail(e);
  }
}

export async function clearScheduleAction(): Promise<AdminResult> {
  try {
    const admin = await requireAdmin();
    await updateSettings({ scheduledDate: null, scheduledPrice: null });
    await logAudit(admin.name, "Removed scheduled price");
    refreshAll();
    return { ok: true, message: "Schedule removed" };
  } catch (e) {
    return fail(e);
  }
}

export async function addStockAction(input: z.input<typeof stockAddSchema>): Promise<AdminResult> {
  const parsed = stockAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const admin = await requireAdmin();
    await updateSettings({ stock: { increment: parsed.data.trays }, costFarm: parsed.data.costPerTray });
    await logAudit(admin.name, `Added ${parsed.data.trays} trays`, `farm cost ${inr(parsed.data.costPerTray)}/tray`);
    refreshAll();
    return { ok: true, message: `${parsed.data.trays} trays added` };
  } catch (e) {
    return fail(e);
  }
}

export async function setStockAction(input: z.input<typeof stockSetSchema>): Promise<AdminResult> {
  const parsed = stockSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const admin = await requireAdmin();
    const s = await getSettings();
    await updateSettings({ stock: parsed.data.trays });
    await logAudit(admin.name, `Stock set ${s.stock} → ${parsed.data.trays}`, parsed.data.reason);
    refreshAll();
    return { ok: true, message: "Stock count saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveSettingsAction(input: SettingsInput): Promise<AdminResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const s = parsed.data;
  const bad = s.slots.find((x) => x.end <= x.start);
  if (bad) return { ok: false, errors: { slots: `"${bad.label}" ends before it starts.` } };
  try {
    const admin = await requireAdmin();
    await updateSettings({
      storeName: s.storeName,
      areaName: s.areaName,
      supportPhone: s.supportPhone,
      pincodesJson: JSON.stringify(s.pincodes),
      openTime: s.openTime,
      cutoff: s.cutoff,
      deadline: s.deadline,
      daysAhead: s.daysAhead,
      slotsJson: JSON.stringify(s.slots),
      deliveryFee: Math.round(s.deliveryFee),
      freeDeliveryFrom: s.freeDeliveryFrom,
      maxTrays: s.maxTrays,
      targetContribution: s.targetContribution,
      codEnabled: s.codEnabled,
      onlineEnabled: s.onlineEnabled,
    });
    await logAudit(admin.name, "Updated delivery settings", `cutoff ${fmtTime(s.cutoff)}, ${s.slots.length} windows`);
    refreshAll();
    return { ok: true, message: "Settings saved" };
  } catch (e) {
    return fail(e);
  }
}

const MODE_TEXT: Record<StoreMode, { audit: string; toast: string }> = {
  auto: { audit: "Store set to automatic hours", toast: "Store follows its hours again" },
  open: { audit: "Store opened manually", toast: "Store is open" },
  closed: { audit: "Store closed manually", toast: "Store is closed" },
};

/** Open, close, or hand the store back to its daily hours. */
export async function setStoreModeAction(mode: StoreMode): Promise<AdminResult> {
  if (mode !== "auto" && mode !== "open" && mode !== "closed") return { ok: false, errors: { form: "Unknown store mode." } };
  try {
    const admin = await requireAdmin();
    await updateSettings({ storeMode: mode, salesPaused: mode === "closed" });
    await logAudit(admin.name, MODE_TEXT[mode].audit);
    refreshAll();
    return { ok: true, message: MODE_TEXT[mode].toast };
  } catch (e) {
    return fail(e);
  }
}

/** Mark the store out of stock (or back in stock). */
export async function setOutOfStockAction(outOfStock: boolean): Promise<AdminResult> {
  try {
    const admin = await requireAdmin();
    await updateSettings({ outOfStock: !!outOfStock });
    await logAudit(admin.name, outOfStock ? "Marked out of stock" : "Marked back in stock");
    refreshAll();
    return { ok: true, message: outOfStock ? "Marked out of stock" : "Back in stock" };
  } catch (e) {
    return fail(e);
  }
}

export async function advanceOrderAction(id: string): Promise<AdminResult> {
  try {
    const admin = await requireAdmin();
    const o = await orders.advanceOrder(id, admin.name);
    refreshAll();
    revalidatePath(`/order/${id}`);
    return { ok: true, message: `${id} marked ${o.status}` };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelOrderAction(id: string): Promise<AdminResult> {
  try {
    const admin = await requireAdmin();
    await orders.cancelOrder(id, admin.name);
    refreshAll();
    revalidatePath(`/order/${id}`);
    return { ok: true, message: "Order cancelled" };
  } catch (e) {
    return fail(e);
  }
}

export async function markPaidAction(id: string): Promise<AdminResult> {
  try {
    const admin = await requireAdmin();
    await orders.markPaid(id, admin.name);
    refreshAll();
    revalidatePath(`/order/${id}`);
    return { ok: true, message: "Payment recorded" };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveIssueAction(id: string): Promise<AdminResult> {
  try {
    const admin = await requireAdmin();
    await orders.resolveIssue(id, admin.name);
    refreshAll();
    revalidatePath(`/order/${id}`);
    return { ok: true, message: "Report marked resolved" };
  } catch (e) {
    return fail(e);
  }
}

/** Add or update a delivery area. */
export async function saveZoneAction(input: ZoneFormInput): Promise<AdminResult<Zone>> {
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const admin = await requireAdmin();
    const z = await zones.saveZone(parsed.data);
    await logAudit(admin.name, `${parsed.data.id ? "Updated" : "Added"} delivery area "${z.name}"`, z.kind === "circle" ? `circle ${((z.radiusM ?? 0) / 1000).toFixed(1)} km` : `${z.points.length}-point area`);
    refreshAll();
    return { ok: true, message: parsed.data.id ? "Area saved" : "Area added", data: z };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteZoneAction(id: string): Promise<AdminResult> {
  try {
    const admin = await requireAdmin();
    const all = await zones.listZones();
    const z = all.find((x) => x.id === id);
    if (!z) return { ok: false, errors: { form: "That area no longer exists." } };
    await zones.deleteZone(id);
    await logAudit(admin.name, `Removed delivery area "${z.name}"`);
    refreshAll();
    return { ok: true, message: "Area removed" };
  } catch (e) {
    return fail(e);
  }
}

/** Add or update a delivery partner. Logging in with this mobile number opens the rider dashboard. */
export async function saveRiderAction(input: RiderInput): Promise<AdminResult> {
  const parsed = riderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const admin = await requireAdmin();
    const r = await riders.saveRider(parsed.data);
    await logAudit(admin.name, `${parsed.data.id ? "Updated" : "Added"} rider ${r.name}`, `+91 ${r.phone}${r.active ? "" : " (off)"}`);
    refreshAll();
    revalidatePath("/admin/riders");
    return { ok: true, message: parsed.data.id ? "Rider saved" : "Rider added" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRiderAction(id: string): Promise<AdminResult> {
  try {
    const admin = await requireAdmin();
    const r = (await riders.listRiders()).find((x) => x.id === id);
    if (!r) return { ok: false, errors: { form: "That rider no longer exists." } };
    await riders.deleteRider(id);
    await logAudit(admin.name, `Removed rider ${r.name}`);
    refreshAll();
    revalidatePath("/admin/riders");
    return { ok: true, message: "Rider removed" };
  } catch (e) {
    return fail(e);
  }
}
