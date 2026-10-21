import "server-only";
import type { Prisma, StoreConfig } from "@prisma/client";
import { prisma } from "./db";
import type { DeliverySlot, StoreSettings } from "@/lib/types";

const DEFAULT_SLOTS: DeliverySlot[] = [
  { id: "s1", label: "6–8 PM", start: "18:00", end: "20:00", capacity: 8 },
  { id: "s2", label: "8–9 PM", start: "20:00", end: "21:00", capacity: 4 },
];

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function toSettings(row: StoreConfig): StoreSettings {
  const slots = parseJson<DeliverySlot[]>(row.slotsJson, []);
  return {
    storeName: row.storeName,
    areaName: row.areaName,
    supportPhone: row.supportPhone,
    price: row.price,
    priceUpdatedAt: row.priceUpdatedAt,
    scheduled: row.scheduledDate && row.scheduledPrice ? { date: row.scheduledDate, price: row.scheduledPrice } : null,
    costs: {
      farm: row.costFarm,
      inbound: row.costInbound,
      packaging: row.costPackaging,
      payment: row.costPayment,
      delivery: row.costDelivery,
    },
    targetContribution: row.targetContribution,
    stock: row.stock,
    salesPaused: row.salesPaused,
    cutoff: row.cutoff,
    deadline: row.deadline,
    daysAhead: row.daysAhead,
    slots: slots.length ? slots : DEFAULT_SLOTS,
    deliveryFee: row.deliveryFee,
    freeDeliveryFrom: row.freeDeliveryFrom,
    maxTrays: row.maxTrays,
    pincodes: parseJson<string[]>(row.pincodesJson, []),
    codEnabled: row.codEnabled,
    upiOnDelivery: row.upiOnDelivery,
  };
}

type Tx = Prisma.TransactionClient;

/** Load the single settings row, creating defaults on first run. */
export async function getSettings(tx: Tx = prisma): Promise<StoreSettings> {
  const row =
    (await tx.storeConfig.findUnique({ where: { id: 1 } })) ??
    (await tx.storeConfig.create({ data: { id: 1, slotsJson: JSON.stringify(DEFAULT_SLOTS) } }));
  return toSettings(row);
}

export async function updateSettings(data: Prisma.StoreConfigUpdateInput, tx: Tx = prisma): Promise<StoreSettings> {
  await getSettings(tx); // ensure the row exists
  const row = await tx.storeConfig.update({ where: { id: 1 }, data });
  return toSettings(row);
}
