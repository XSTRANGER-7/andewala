"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { cn } from "@/lib/cn";

/** A small, still map showing a saved address's pin. */
export function PinPreview({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !box.current) return;
      if (!map.current) {
        map.current = L.map(box.current, {
          zoomControl: false,
          dragging: false,
          scrollWheelZoom: false,
          touchZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          attributionControl: true,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map.current);
      }
      map.current.setView([lat, lng], 18);
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return (
    <div className={cn("relative isolate h-36 overflow-hidden rounded-xl border border-line bg-mint-100", className)}>
      <div ref={box} className="absolute inset-0 z-0" role="img" aria-label="Map showing the delivery pin" />
      <svg width="30" height="38" viewBox="0 0 36 46" className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full drop-shadow-md" aria-hidden="true">
        <path d="M18 1C8.6 1 1 8.4 1 17.6 1 30 18 45 18 45s17-15 17-27.4C35 8.4 27.4 1 18 1Z" fill="#1f4d3f" />
        <circle cx="18" cy="17.5" r="6.5" fill="#f0a400" />
      </svg>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
        className="absolute right-2 top-2 z-[500] rounded-full bg-paper/95 px-2.5 py-1 text-[11px] font-semibold text-forest-900 shadow ring-1 ring-line hover:bg-mint-50"
      >
        Open in Google Maps
      </a>
    </div>
  );
}
