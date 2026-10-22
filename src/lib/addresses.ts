"use client";

import { useMemo, useSyncExternalStore } from "react";
import { distanceMeters } from "./geo";

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

/** A found location older than this is refreshed when the site opens or comes back to the front. */
export const LOCATED_MAX_AGE_MS = 30 * 60 * 1000;

const LOCATING_EVENT = "eggspress:locating";
/**
 * Where the automatic lookup stands:
 * idle (not tried yet) · locating · done · denied (location blocked) ·
 * waiting (the browser didn't answer: a hidden or ignored prompt) · error (no GPS, timed out).
 */
export type LocateStatus = "idle" | "locating" | "done" | "denied" | "waiting" | "error";
let status: LocateStatus = "idle";
function setStatus(v: LocateStatus) {
  status = v;
  window.dispatchEvent(new Event(LOCATING_EVENT));
}
const subscribeStatus = (cb: () => void) => {
  window.addEventListener(LOCATING_EVENT, cb);
  return () => window.removeEventListener(LOCATING_EVENT, cb);
};

/** The automatic location lookup's state, for the header and the strip under it. */
export function useLocateStatus(): LocateStatus {
  return useSyncExternalStore(subscribeStatus, () => status, () => "idle");
}

/** True while the visitor's location is being looked up (the header shows "Finding you…"). */
export function useLocating(): boolean {
  return useLocateStatus() === "locating";
}

function readLocated(): Located | null {
  try {
    const raw = get();
    return raw ? (JSON.parse(raw) as Located) : null;
  } catch {
    return null;
  }
}

const isFresh = (l: Located | null) => !!l && l.lat != null && l.lng != null && Date.now() - Date.parse(l.at) < LOCATED_MAX_AGE_MS;

async function permissionState(): Promise<PermissionState | "unknown"> {
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    return "unknown";
  }
}

function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      // A quick network fix is enough to tell whether we deliver there. No timeout: the clock
      // would also run while a permission prompt waits for the visitor's answer.
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** Area name and PIN code for a point (BigDataCloud's free, keyless lookup). Null when it fails. */
async function areaFor(p: { lat: number; lng: number }): Promise<{ area: string; pincode: string } | null> {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${p.lat}&longitude=${p.lng}&localityLanguage=en`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { locality?: string; city?: string; principalSubdivision?: string; postcode?: string };
    const area = [j.locality, j.city].filter((x, i, arr) => x && arr.indexOf(x) === i).join(", ") || j.principalSubdivision || "";
    return area ? { area, pincode: (j.postcode ?? "").replace(/\D/g, "").slice(0, 6) } : null;
  } catch {
    return null;
  }
}

let pending: Promise<void> | null = null;

/**
 * Know where the visitor is, on every visit: when the site loads, when the
 * installed app opens, and when it comes back to the front after a while.
 * - a location found in the last 30 minutes is kept;
 * - if the visitor blocked location, we don't ask again;
 * - otherwise the browser is asked (a new visitor sees its permission prompt).
 * The coordinates are saved the moment they arrive, so "do we deliver here?"
 * is answered at once; the area name for the header follows a moment later.
 */
export function ensureLocated(opts: { force?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!opts.force && isFresh(readLocated())) {
    if (status !== "done") setStatus("done");
    return Promise.resolve();
  }
  // A tap on "Use my location" always asks again (with a tap the browser shows its prompt),
  // even if an earlier automatic request is still waiting on an unanswered prompt.
  if (!pending || opts.force) {
    let mine: Promise<void> | null = null;
    mine = (async () => {
      // Blocked earlier: the browser won't ask again until the visitor allows it in settings.
      if (!opts.force && (await permissionState()) === "denied") return setStatus("denied");
      setStatus("locating");
      // A prompt the visitor hasn't answered (or one the browser tucked away) gets a visible
      // "Use my location" button after a few seconds instead of a silent wait.
      const nudge = setTimeout(() => status === "locating" && setStatus("waiting"), 4000);
      try {
        const p = await getPosition();
        const prev = readLocated();
        // Same place as last time: keep its name while the new one loads.
        const same = !!prev && prev.lat != null && prev.lng != null && distanceMeters({ lat: prev.lat, lng: prev.lng }, p) < 300;
        saveLocated({ area: same ? prev!.area : "Your location", pincode: same ? prev!.pincode : "", ...p });
        setStatus("done");
        // The area name is a nice-to-have: look it up without holding up the next refresh.
        void areaFor(p).then((named) => {
          const now = readLocated();
          if (named && now && now.lat === p.lat && now.lng === p.lng) saveLocated({ ...named, ...p });
        });
      } catch (e) {
        // blocked, timed out or unsupported: the strip under the header explains and offers a way on
        const code = (e as GeolocationPositionError)?.code;
        setStatus(code === 1 ? "denied" : code === 3 ? "waiting" : "error");
      } finally {
        clearTimeout(nudge);
        if (pending === mine) pending = null;
      }
    })();
    pending = mine;
  }
  return pending ?? Promise.resolve();
}

/**
 * "Use my current location" in the header picker: ask for the position now
 * and name the area. Throws a readable message when location isn't available.
 */
export async function detectLocation(): Promise<Omit<Located, "at">> {
  const p = await getPosition().catch((e: GeolocationPositionError | Error) => {
    throw new Error("code" in e && e.code === 1 ? "Location permission was blocked. Allow it in the browser, or pick a saved address." : "Couldn't get your location. Try again or pick a saved address.");
  });
  const named = await areaFor(p);
  return { area: named?.area ?? "Your location", pincode: named?.pincode ?? "", ...p };
}
