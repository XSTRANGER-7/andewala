"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { LatLng } from "@/lib/geo";

type Props = {
  rider: LatLng | null;
  /** Stops in visiting order. */
  stops: { point: LatLng; label: string }[];
  /** Road path to draw (falls back to straight lines). */
  line: LatLng[] | null;
};

/** The rider's run: their position, numbered stops in order, and the path between them. */
export function RiderMap({ rider, stops, line }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lib = await import("leaflet");
      if (cancelled || !box.current || map.current) return;
      L.current = lib;
      const m = lib.map(box.current, { zoomControl: true }).setView([22.5, 79], 5);
      lib.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(m);
      layer.current = lib.layerGroup().addTo(m);
      map.current = m;
      draw();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const lib = L.current;
    const m = map.current;
    const g = layer.current;
    if (!lib || !m || !g) return;
    g.clearLayers();
    const all: [number, number][] = [];
    const path = line ?? [...(rider ? [rider] : []), ...stops.map((s) => s.point)];
    if (path.length > 1) {
      lib.polyline(path.map((p) => [p.lat, p.lng] as [number, number]), { color: "#1f4d3f", weight: 5, opacity: 0.75, dashArray: line ? undefined : "8 8" }).addTo(g);
    }
    if (rider) {
      all.push([rider.lat, rider.lng]);
      lib
        .marker([rider.lat, rider.lng], {
          icon: lib.divIcon({ className: "", html: '<div style="width:18px;height:18px;border-radius:999px;background:#1a73e8;border:3px solid #fff;box-shadow:0 0 0 6px rgb(26 115 232/.25)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        })
        .bindTooltip("You", { direction: "top", offset: [0, -10] })
        .addTo(g);
    }
    stops.forEach((s, i) => {
      all.push([s.point.lat, s.point.lng]);
      const next = i === 0;
      lib
        .marker([s.point.lat, s.point.lng], {
          zIndexOffset: next ? 1000 : 0,
          icon: lib.divIcon({
            className: "",
            html: `<div style="display:grid;place-items:center;width:${next ? 32 : 26}px;height:${next ? 32 : 26}px;border-radius:999px;background:${next ? "#f0a400" : "#1f4d3f"};color:${next ? "#17231e" : "#fff"};font:700 ${next ? 15 : 13}px system-ui;border:2px solid #fff;box-shadow:0 2px 6px rgb(0 0 0/.35)">${i + 1}</div>`,
            iconSize: [next ? 32 : 26, next ? 32 : 26],
            iconAnchor: [next ? 16 : 13, next ? 16 : 13],
          }),
        })
        .bindTooltip(s.label, { direction: "top", offset: [0, -14] })
        .addTo(g);
    });
    if (all.length === 1) m.setView(all[0], 15);
    else if (all.length > 1) m.fitBounds(lib.latLngBounds(all), { padding: [30, 30], maxZoom: 16 });
  }

  useEffect(draw, [rider, stops, line]);  

  return <div ref={box} className="relative z-0 h-full w-full" aria-label="Delivery route map" />;
}
