/** Browser-side location helpers: live position, distance between points, and address lookup for a map pin. */

export type LatLng = { lat: number; lng: number };
export type Position = LatLng & { accuracy: number };
export type LocateError = "unsupported" | "denied" | "unavailable" | "timeout" | "insecure";

/** Ask the browser for the device's position (GPS on phones). */
export function getCurrentPosition(opts: { timeout?: number; maximumAge?: number } = {}): Promise<{ ok: true; pos: Position } | { ok: false; error: LocateError }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return resolve({ ok: false, error: "unsupported" });
    if (!window.isSecureContext) return resolve({ ok: false, error: "insecure" });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok: true, pos: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (e) => resolve({ ok: false, error: e.code === e.PERMISSION_DENIED ? "denied" : e.code === e.TIMEOUT ? "timeout" : "unavailable" }),
      { enableHighAccuracy: true, timeout: opts.timeout ?? 12_000, maximumAge: opts.maximumAge ?? 0 },
    );
  });
}

export function locateErrorText(e: LocateError): string {
  switch (e) {
    case "denied":
      return "Location access is blocked. Allow location for this site in your browser settings, or move the map to your door.";
    case "insecure":
      return "Live location needs a secure (https) connection. Move the map to your door instead.";
    case "unsupported":
      return "This browser can't share your location. Move the map to your door instead.";
    case "timeout":
      return "Finding your location took too long. Try again outdoors or near a window, or move the map.";
    default:
      return "We couldn't find your location. Turn on location (GPS) and try again, or move the map.";
  }
}

/** Straight-line distance in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export type PlaceGuess = { line: string; area: string; pincode: string };

/** Readable address for a pin, from OpenStreetMap's Nominatim. Returns null when the lookup fails. */
export async function reverseGeocode(p: LatLng, signal?: AbortSignal): Promise<PlaceGuess | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${p.lat.toFixed(6)}&lon=${p.lng.toFixed(6)}&accept-language=en`;
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const a = j.address ?? {};
    const parts = [a.house_number, a.building, a.road, a.neighbourhood, a.suburb ?? a.residential, a.city_district, a.city ?? a.town ?? a.village].filter(Boolean);
    const line = [...new Set(parts)].join(", ") || (j.display_name ?? "");
    const area = [a.suburb ?? a.neighbourhood ?? a.residential, a.city ?? a.town ?? a.village].filter(Boolean).join(", ");
    return { line, area, pincode: (a.postcode ?? "").replace(/\s/g, "").slice(0, 6) };
  } catch {
    return null;
  }
}

/** Rough centre of an Indian PIN code, to start the map near the customer when live location isn't available. */
export async function geocodePincode(pincode: string, signal?: AbortSignal): Promise<LatLng | null> {
  if (!/^\d{6}$/.test(pincode)) return null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&postalcode=${pincode}`, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}

/**
 * Keep listening to the GPS until the fix is good enough. The first reading a
 * phone gives is often a rough network fix (50–1000 m); the GPS chip then
 * tightens it over the next seconds. `onUpdate` gets every better reading;
 * the promise resolves with the best one once it is within `target` metres,
 * or when `maxWait` runs out.
 */
export function watchBestPosition(opts: { target?: number; maxWait?: number; onUpdate?: (p: Position) => void } = {}): {
  done: Promise<{ ok: true; pos: Position } | { ok: false; error: LocateError }>;
  stop: () => void;
} {
  const target = opts.target ?? 10;
  let stop = () => {};
  const done = new Promise<{ ok: true; pos: Position } | { ok: false; error: LocateError }>((resolve) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return resolve({ ok: false, error: "unsupported" });
    if (!window.isSecureContext) return resolve({ ok: false, error: "insecure" });
    let best: Position | null = null;
    let finished = false;
    const finish = (r: { ok: true; pos: Position } | { ok: false; error: LocateError }) => {
      if (finished) return;
      finished = true;
      navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      resolve(r);
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        if (best && pos.accuracy >= best.accuracy) return;
        best = pos;
        opts.onUpdate?.(pos);
        if (pos.accuracy <= target) finish({ ok: true, pos });
      },
      (e) => {
        if (best) return finish({ ok: true, pos: best });
        if (e.code === e.TIMEOUT) return; // keep waiting until maxWait
        finish({ ok: false, error: e.code === e.PERMISSION_DENIED ? "denied" : "unavailable" });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: opts.maxWait ?? 25_000 },
    );
    const timer = setTimeout(() => finish(best ? { ok: true, pos: best } : { ok: false, error: "timeout" }), opts.maxWait ?? 25_000);
    stop = () => finish(best ? { ok: true, pos: best } : { ok: false, error: "timeout" });
  });
  return { done, stop: () => stop() };
}
