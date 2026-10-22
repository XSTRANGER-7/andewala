"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Browser-side location helpers. Saved addresses live on the customer's
 * account in the database; this file only remembers the area the browser
 * located for visitors who aren't logged in.
 */
const LOCATED_KEY = "eggspress:located";
const EVENT = "eggspress:located-change";

export type Located = { area: string; pincode: string; at: string; lat?: number; lng?: number };
export type ShortAddress = { address: string; landmark: string; pincode: string };

/** A short label for the header: the first part of the street line, plus the PIN code. */
export function shortLabel(a: ShortAddress): string {
  const first = a.address.split(",").map((s) => s.trim()).filter(Boolean)[0] ?? "";
  const base = first.length > 22 ? first.slice(0, 21) + "…" : first;
  return [base || a.landmark, a.pincode].filter(Boolean).join(" · ") || "Saved address";
}

function get(): string | null {
  try {
    return localStorage.getItem(LOCATED_KEY);
  } catch {
    return null;
  }
}

export function saveLocated(l: Omit<Located, "at">): void {
  try {
    localStorage.setItem(LOCATED_KEY, JSON.stringify({ ...l, at: new Date().toISOString() }));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The last area found with "Use my current location", or null. */
export function useLocated(): Located | null {
  const raw = useSyncExternalStore(subscribe, get, () => null);
  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Located;
    } catch {
      return null;
    }
  }, [raw]);
}

let pending: Promise<void> | null = null;

/**
 * Make sure we know the visitor's area: if no location has been found yet,
 * ask the browser for it once (shared between callers, errors ignored).
 * Used when the site opens and when Order now is tapped.
 */
export function ensureLocated(): Promise<void> {
  if (typeof window === "undefined" || get()) return Promise.resolve();
  if (!pending) {
    pending = detectLocation()
      .then(saveLocated)
      .catch(() => {})
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/**
 * Ask the browser for the device location and turn it into an area name and
 * PIN code. Uses BigDataCloud's free client-side reverse-geocoding endpoint,
 * which needs no key; only the coordinates are sent, and only when the
 * customer taps "Use my current location".
 */
export async function detectLocation(): Promise<Omit<Located, "at">> {
  if (!("geolocation" in navigator)) throw new Error("This browser can't share its location.");
  const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 }),
  ).catch((e: GeolocationPositionError) => {
    throw new Error(e.code === 1 ? "Location permission was blocked. Allow it in the browser, or pick a saved address." : "Couldn't get your location. Try again or pick a saved address.");
  });
  const { latitude, longitude } = pos.coords;
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) throw new Error("Found you, but couldn't look up the area name. Pick a saved address instead.");
  const j = (await res.json()) as { locality?: string; city?: string; principalSubdivision?: string; postcode?: string };
  const area = [j.locality, j.city].filter((x, i, arr) => x && arr.indexOf(x) === i).join(", ") || j.principalSubdivision || "Your location";
  return { area, pincode: (j.postcode ?? "").replace(/\D/g, "").slice(0, 6), lat: latitude, lng: longitude };
}
