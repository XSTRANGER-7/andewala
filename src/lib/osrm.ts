/**
 * Road distances and route lines from OSRM (OpenStreetMap routing), called from
 * the rider's browser. The public server is free and needs no key; if it is
 * slow or down we fall back to straight-line distances, so routing never blocks.
 */
import type { LatLng } from "./geo";
import { straightLineMatrix, type Matrix } from "./route";

const BASE = "https://router.project-osrm.org";
/** Roads are rarely straight: scale straight-line distance to estimate road distance when OSRM gives none. */
const DETOUR = 1.35;

const coords = (pts: LatLng[]) => pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");

async function getJson<T>(url: string, ms = 7000): Promise<T | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export type DistanceData = { matrix: Matrix; durations: Matrix | null; source: "road" | "straight" };

/** Distance matrix in metres (index 0 = rider). Road distances when available. */
export async function distanceMatrix(points: LatLng[]): Promise<DistanceData> {
  const straight = straightLineMatrix(points).map((row) => row.map((d) => d * DETOUR));
  if (points.length < 2 || points.length > 25) return { matrix: straight, durations: null, source: "straight" };
  const j = await getJson<{ code: string; distances?: (number | null)[][]; durations?: (number | null)[][] }>(`${BASE}/table/v1/driving/${coords(points)}?annotations=distance,duration`);
  if (!j || j.code !== "Ok" || !j.distances) return { matrix: straight, durations: null, source: "straight" };
  const matrix = j.distances.map((row, i) => row.map((d, k) => (typeof d === "number" ? d : straight[i][k])));
  const durations = j.durations ? j.durations.map((row) => row.map((d) => (typeof d === "number" ? d : 0))) : null;
  return { matrix, durations, source: "road" };
}

/** The road path through the points in order, for drawing on the map (null when unavailable). */
export async function routeLine(points: LatLng[]): Promise<LatLng[] | null> {
  if (points.length < 2 || points.length > 25) return null;
  const j = await getJson<{ code: string; routes?: { geometry: { coordinates: [number, number][] } }[] }>(
    `${BASE}/route/v1/driving/${coords(points)}?overview=full&geometries=geojson`,
  );
  const line = j?.code === "Ok" ? j.routes?.[0]?.geometry.coordinates : null;
  return line ? line.map(([lng, lat]) => ({ lat, lng })) : null;
}

/** Google Maps turn-by-turn through the stops in order (Google allows up to 9 stops in between). */
export function googleMapsRoute(from: LatLng | null, stops: LatLng[]): string {
  const ll = (p: LatLng) => `${p.lat},${p.lng}`;
  const dest = stops[stops.length - 1];
  const via = stops.slice(0, -1).slice(0, 9);
  const params = new URLSearchParams({ api: "1", destination: ll(dest), travelmode: "driving" });
  if (from) params.set("origin", ll(from));
  if (via.length) params.set("waypoints", via.map(ll).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
