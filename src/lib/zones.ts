/**
 * Delivery areas: circles around hubs and polygons around neighbourhoods.
 * Pure functions, used on the server (to enforce) and in the browser (to show
 * the answer instantly). With a handful of areas this is a few microseconds,
 * so no spatial database or index is needed.
 */
import { distanceMeters, type LatLng } from "./geo";

export type Zone = {
  id: string;
  name: string;
  kind: "circle" | "polygon";
  /** Circle centre (also the label point for polygons). */
  center: LatLng | null;
  radiusM: number | null;
  /** Polygon corners in order. */
  points: LatLng[];
  active: boolean;
  color: string;
};

/** What decides whether a place gets deliveries. */
export type Coverage = {
  /** Active delivery areas. When there is at least one, they are the rule. */
  zones: Zone[];
  /** Fallback when no areas are drawn: allowed PIN codes (empty = everywhere). */
  pincodes: string[];
};

/** Ray casting: count how many polygon edges a ray from the point crosses. Odd = inside. */
export function pointInPolygon(p: LatLng, poly: LatLng[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const crosses = a.lat > p.lat !== b.lat > p.lat && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function zoneContains(z: Zone, p: LatLng): boolean {
  if (z.kind === "circle") return !!z.center && z.radiusM !== null && distanceMeters(z.center, p) <= z.radiusM;
  return pointInPolygon(p, z.points);
}

/** Active areas that contain the point, nearest centre first (decides which hub an order belongs to). */
export function zonesAt(zones: Zone[], p: LatLng): Zone[] {
  const hits = zones.filter((z) => z.active && zoneContains(z, p));
  return hits.sort((a, b) => (a.center && b.center ? distanceMeters(a.center, p) - distanceMeters(b.center, p) : 0));
}

export const usesZones = (c: Coverage) => c.zones.some((z) => z.active);

/**
 * Can we deliver here? `true`/`false`, or `null` when we can't tell yet
 * (areas are in use but there's no map pin).
 */
export function isCovered(c: Coverage, place: { lat?: number | null; lng?: number | null; pincode?: string }): boolean | null {
  if (usesZones(c)) {
    if (place.lat == null || place.lng == null) return null;
    return zonesAt(c.zones, { lat: place.lat, lng: place.lng }).length > 0;
  }
  if (!c.pincodes.length) return true;
  const pin = (place.pincode ?? "").trim();
  return /^\d{6}$/.test(pin) ? c.pincodes.includes(pin) : null;
}

/** "Sector 21, Model Town" or "110001, 110002": a short line for where we deliver. */
export function coverageText(c: Coverage, fallback: string): string {
  if (usesZones(c)) return c.zones.filter((z) => z.active).map((z) => z.name).join(", ");
  return c.pincodes.length ? c.pincodes.join(", ") : fallback;
}

/** Rough centre of all areas, to start a map on. */
export function coverageCenter(c: Coverage): LatLng | null {
  const pts = c.zones.filter((z) => z.active).flatMap((z) => (z.kind === "circle" && z.center ? [z.center] : z.points));
  if (!pts.length) return null;
  return { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length };
}

/** Centre of a polygon (average of corners): good enough for a label and for sorting. */
export function polygonCenter(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  return { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lng: points.reduce((s, p) => s + p.lng, 0) / points.length };
}
