import "server-only";
import { cache } from "react";
import type { DeliveryZone, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { polygonCenter, type Zone } from "@/lib/zones";
import type { LatLng } from "@/lib/geo";

type Tx = Prisma.TransactionClient;

export function toZone(r: DeliveryZone): Zone {
  let points: LatLng[] = [];
  try {
    const raw = JSON.parse(r.pointsJson) as [number, number][];
    points = Array.isArray(raw) ? raw.filter((p) => Array.isArray(p) && p.length === 2).map(([lat, lng]) => ({ lat, lng })) : [];
  } catch {
    points = [];
  }
  const kind = r.kind === "polygon" ? "polygon" : "circle";
  const center = r.centerLat !== null && r.centerLng !== null ? { lat: r.centerLat, lng: r.centerLng } : kind === "polygon" ? polygonCenter(points) : null;
  return { id: r.id, name: r.name, kind, center, radiusM: r.radiusM, points, active: r.active, color: r.color };
}

/** Every area, for the admin page. */
export async function listZones(tx: Tx = prisma): Promise<Zone[]> {
  const rows = await tx.deliveryZone.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toZone);
}

/** Active areas, read once per request and shared by the page, header and checks. */
export const getActiveZones = cache(async (): Promise<Zone[]> => (await listZones()).filter((z) => z.active));

export type ZoneInput = {
  id?: string;
  name: string;
  kind: "circle" | "polygon";
  center?: LatLng | null;
  radiusM?: number | null;
  points?: LatLng[];
  active: boolean;
  color?: string;
};

export async function saveZone(z: ZoneInput): Promise<Zone> {
  const data = {
    name: z.name.trim(),
    kind: z.kind,
    centerLat: z.kind === "circle" ? (z.center?.lat ?? null) : null,
    centerLng: z.kind === "circle" ? (z.center?.lng ?? null) : null,
    radiusM: z.kind === "circle" ? Math.round(z.radiusM ?? 0) : null,
    pointsJson: JSON.stringify(z.kind === "polygon" ? (z.points ?? []).map((p) => [round(p.lat), round(p.lng)]) : []),
    active: z.active,
    color: z.color ?? "#2f7d5b",
  };
  const row = z.id ? await prisma.deliveryZone.update({ where: { id: z.id }, data }) : await prisma.deliveryZone.create({ data });
  return toZone(row);
}

export async function deleteZone(id: string): Promise<void> {
  await prisma.deliveryZone.delete({ where: { id } });
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
