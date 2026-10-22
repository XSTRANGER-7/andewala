"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Circle, Map as LeafletMap } from "leaflet";
import { IconLocate } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { coverageCenter, isCovered, usesZones, zonesAt, type Coverage } from "@/lib/zones";
import { geocodePincode, locateErrorText, reverseGeocode, watchBestPosition, type LatLng, type PlaceGuess, type Position } from "@/lib/geo";

type Props = {
  /** The saved pin, or null when there isn't one yet. */
  value: LatLng | null;
  onChange: (pin: LatLng, guess: PlaceGuess | null) => void;
  /** Find the live location as soon as the map opens (when there's no pin yet). */
  autoLocate?: boolean;
  /** Where to centre the map when there's no pin and no live location: a delivery PIN code. */
  fallbackPincode?: string;
  /** Delivery areas to shade on the map, and to answer "do you deliver here?" live. */
  coverage?: Coverage;
  error?: string;
};

const INDIA: LatLng = { lat: 22.5, lng: 79 };
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Pin-drop map. The pin stays in the centre and the customer moves the map
 * under it, which is easier to place exactly than dragging a small marker on
 * a phone. "Use my current location" jumps to the live GPS position.
 */
export function MapPicker({ value, onChange, autoLocate, fallbackPincode, coverage, error }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const ring = useRef<Circle | null>(null);
  const onChangeRef = useRef(onChange);
  const lookup = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  /** Stops the running GPS watch. */
  const stopWatch = useRef<(() => void) | null>(null);
  /** True once the customer drags the map themselves: from then on the GPS no longer moves it. */
  const userMoved = useRef(false);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  /** Show a GPS reading: the accuracy ring, and move the pin there unless the customer is placing it by hand. */
  async function showFix(pos: Position) {
    const m = map.current;
    if (!m) return;
    setAccuracy(pos.accuracy);
    const L = await import("leaflet");
    ring.current?.remove();
    ring.current = L.circle([pos.lat, pos.lng], { radius: Math.min(pos.accuracy, 1000), color: "#1f4d3f", weight: 1, fillOpacity: 0.08, interactive: false }).addTo(m);
    if (!userMoved.current) m.setView([pos.lat, pos.lng], pos.accuracy <= 30 ? 19 : pos.accuracy <= 150 ? 18 : 16);
  }

  /**
   * Live location. Phones first give a rough network fix, then the GPS chip
   * tightens it over a few seconds, so keep listening and move the pin with
   * each better reading until it is within about 10 m (or 25 s pass).
   */
  async function locate() {
    stopWatch.current?.();
    userMoved.current = false;
    setLocating(true);
    setNotice(null);
    setAccuracy(null);
    const w = watchBestPosition({ target: 10, maxWait: 25_000, onUpdate: (p) => void showFix(p) });
    stopWatch.current = w.stop;
    const r = await w.done;
    if (stopWatch.current === w.stop) stopWatch.current = null;
    setLocating(false);
    if (!r.ok) return setNotice(locateErrorText(r.error));
    if (r.pos.accuracy > 25) {
      setNotice(
        r.pos.accuracy > 150
          ? `Your device could only find you to within about ${Math.round(r.pos.accuracy)} m (laptops and phones indoors have no clear GPS signal). Drag the map so the pin sits exactly on your door.`
          : `GPS is accurate to about ${Math.round(r.pos.accuracy)} m here. For an exact pin, step near a window or outside and tap again, or drag the map onto your door.`,
      );
    }
  }
  const locateRef = useRef(locate);
  useEffect(() => {
    locateRef.current = locate;
  });

  // Create the map once. Leaflet touches `window`, so it's loaded only in the browser.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current || map.current) return;
      const start = value ?? INDIA;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], value ? 18 : 5);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(m);
      // Shade where we deliver.
      for (const z of coverage?.zones ?? []) {
        if (!z.active) continue;
        const style = { color: z.color, weight: 1.5, fillColor: z.color, fillOpacity: 0.1, interactive: false };
        if (z.kind === "circle" && z.center && z.radiusM) L.circle([z.center.lat, z.center.lng], { radius: z.radiusM, ...style }).addTo(m);
        else if (z.points.length >= 3) L.polygon(z.points.map((p) => [p.lat, p.lng] as [number, number]), style).addTo(m);
      }
      map.current = m;
      m.on("movestart", () => setMoving(true));
      // The customer is placing the pin by hand: stop following the GPS.
      m.on("dragstart", () => {
        userMoved.current = true;
        stopWatch.current?.();
      });
      m.on("moveend", () => {
        setMoving(false);
        if (m.getZoom() < 14) return; // too far out to mean a door
        const c = m.getCenter();
        const pin = { lat: round(c.lat), lng: round(c.lng) };
        onChangeRef.current(pin, null);
        // Look up a readable address for the pin, after the map settles.
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
          lookup.current?.abort();
          const ctl = new AbortController();
          lookup.current = ctl;
          const guess = await reverseGeocode(pin, ctl.signal);
          if (ctl.signal.aborted) return;
          setPlace(guess?.line ?? null);
          if (guess) onChangeRef.current(pin, guess);
        }, 700);
      });
      setReady(true);
      if (!value) {
        if (autoLocate) void locateRef.current();
        const areaCenter = coverage ? coverageCenter(coverage) : null;
        const near = areaCenter ?? (fallbackPincode ? await geocodePincode(fallbackPincode) : null);
        // Only use the PIN code centre if live location hasn't already moved the map.
        if (near && !cancelled && m.getZoom() < 14) m.setView([near.lat, near.lng], areaCenter ? 13 : 15);
      }
    })();
    return () => {
      cancelled = true;
      stopWatch.current?.();
      if (timer.current) clearTimeout(timer.current);
      lookup.current?.abort();
      map.current?.remove();
      map.current = null;
    };
    // The map is created once; later pin changes come from the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomedIn = !!value;
  return (
    <div className="grid gap-2">
      <div className={cn("relative isolate h-64 overflow-hidden rounded-xl border bg-mint-100 sm:h-72", error ? "border-bad" : "border-line")}>
        <div ref={box} className="absolute inset-0 z-0" aria-label="Map. Move it to place the pin on your door." />
        {/* the pin: fixed in the centre, lifts while the map moves */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full" aria-hidden="true">
          <svg width="36" height="46" viewBox="0 0 36 46" className={cn("drop-shadow-md transition-transform duration-150", moving && "-translate-y-2")}>
            <path d="M18 1C8.6 1 1 8.4 1 17.6 1 30 18 45 18 45s17-15 17-27.4C35 8.4 27.4 1 18 1Z" fill="#1f4d3f" />
            <circle cx="18" cy="17.5" r="6.5" fill="#f0a400" />
          </svg>
        </div>
        <div className={cn("pointer-events-none absolute left-1/2 top-1/2 z-[499] h-2 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/30 blur-[1px] transition-opacity", moving ? "opacity-40" : "opacity-80")} aria-hidden="true" />
        <button
          type="button"
          onClick={() => void locate()}
          disabled={!ready || locating}
          className="absolute bottom-3 left-1/2 z-[500] inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-paper px-4 py-2 text-sm font-semibold text-forest-900 shadow-md ring-1 ring-line transition hover:bg-mint-50 disabled:opacity-70"
        >
          <IconLocate width={16} height={16} className={cn(locating && "animate-spin")} />
          {locating ? (accuracy !== null ? `Improving accuracy… ±${Math.round(accuracy)} m` : "Finding you…") : "Use my current location"}
        </button>
        {!ready && <div className="absolute inset-0 z-[501] grid place-items-center text-sm text-ink-3">Loading map…</div>}
      </div>
      <p className="text-xs text-ink-2" aria-live="polite">
        {!zoomedIn
          ? "Move the map so the pin sits on your door, or use your current location."
          : place
            ? `Pin near: ${place}`
            : "Pin placed. Move the map to adjust it."}
        {accuracy !== null && zoomedIn && (
          <span className={cn("font-semibold", accuracy <= 15 ? "text-forest-900" : "text-warn")}> · GPS ±{Math.round(accuracy)} m{accuracy <= 15 ? " ✓" : ""}</span>
        )}
      </p>
      {coverage && usesZones(coverage) && value && (
        <p className={cn("text-xs font-semibold", isCovered(coverage, value) ? "text-good" : "text-bad")} aria-live="polite">
          {isCovered(coverage, value) ? `✓ We deliver here${zonesAt(coverage.zones, value)[0] ? ` (${zonesAt(coverage.zones, value)[0].name})` : ""}` : "✗ Outside our delivery area. Move the pin inside the shaded area."}
        </p>
      )}
      {notice && <p className="text-xs text-warn">{notice}</p>}
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
