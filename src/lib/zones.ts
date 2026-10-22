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

/** A spot this close outside an area's edge can still be delivered to, if the customer says so. */
export const NEAR_EDGE_M = 200;

/** Distance from a point to the segment a–b, in metres (flat-earth approximation, fine at city scale). */
function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const kx = Math.cos((p.lat * Math.PI) / 180) * 111_320;
  const ky = 110_540;
  const ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky;
  const bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** How far outside an area the point is, in metres (0 when inside). */
export function distanceOutsideM(z: Zone, p: LatLng): number {
  if (zoneContains(z, p)) return 0;
  if (z.kind === "circle") return z.center && z.radiusM !== null ? Math.max(0, distanceMeters(z.center, p) - z.radiusM) : Infinity;
  if (z.points.length < 3) return Infinity;
  let best = Infinity;
  for (let i = 0, j = z.points.length - 1; i < z.points.length; j = i++) best = Math.min(best, distanceToSegmentM(p, z.points[j], z.points[i]));
  return best;
}

export type CoverageAt =
  | { status: "inside"; zone: Zone | null }
  /** Just outside an area (within NEAR_EDGE_M): we can deliver if the customer confirms. */
  | { status: "near"; zone: Zone; distanceM: number }
  | { status: "outside"; zone: Zone | null; distanceM: number | null }
  /** Can't tell: areas are in use but there's no map pin, or no valid PIN code. */
  | { status: "unknown" };

/** Where does this place stand: inside an area, just outside one, outside, or unknown. */
export function coverageAt(c: Coverage, place: { lat?: number | null; lng?: number | null; pincode?: string }): CoverageAt {
  if (usesZones(c)) {
    if (place.lat == null || place.lng == null) return { status: "unknown" };
    const p = { lat: place.lat, lng: place.lng };
    const hits = zonesAt(c.zones, p);
    if (hits.length) return { status: "inside", zone: hits[0] };
    let nearest: Zone | null = null;
    let d = Infinity;
    for (const z of c.zones) {
      if (!z.active) continue;
      const dz = distanceOutsideM(z, p);
      if (dz < d) [d, nearest] = [dz, z];
    }
    if (nearest && d <= NEAR_EDGE_M) return { status: "near", zone: nearest, distanceM: Math.round(d) };
    return { status: "outside", zone: nearest, distanceM: Number.isFinite(d) ? Math.round(d) : null };
  }
  if (!c.pincodes.length) return { status: "inside", zone: null };
  const pin = (place.pincode ?? "").trim();
  if (!/^\d{6}$/.test(pin)) return { status: "unknown" };
  return c.pincodes.includes(pin) ? { status: "inside", zone: null } : { status: "outside", zone: null, distanceM: null };
}

/**
 * Can we deliver here? `true` inside an area or within NEAR_EDGE_M of one,
 * `false` further out, `null` when we can't tell yet (no map pin).
 */
export function isCovered(c: Coverage, place: { lat?: number | null; lng?: number | null; pincode?: string }): boolean | null {
  const r = coverageAt(c, place);
  return r.status === "unknown" ? null : r.status !== "outside";
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
