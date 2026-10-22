"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { LatLng } from "@/lib/geo";
import type { Zone } from "@/lib/zones";

export type Draft = {
  id?: string;
  name: string;
  kind: "circle" | "polygon";
  center: LatLng | null;
  radiusM: number;
  points: LatLng[];
  active: boolean;
  color: string;
};

type Props = {
  zones: Zone[];
  /** The area being added or edited (drawn on top, with handles). */
  draft: Draft | null;
  /** "Check a location" marker and whether it is covered. */
  probe: { point: LatLng; covered: boolean } | null;
  onMapClick: (p: LatLng) => void;
  onDraftChange: (d: Draft) => void;
  /** Change this to re-fit the map to all areas. */
  fitKey: number;
  /** Change this (with `flyTo`) to move the map, e.g. after a place search. */
  flyTo: { point: LatLng; zoom: number; key: number } | null;
  start: LatLng | null;
};

const pinIcon = (color: string, size = 18) =>
  `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/.45)"></div>`;

/** Leaflet map for the admin's delivery areas. Layers are redrawn from props, so the map always matches the state. */
export function ZoneMap({ zones, draft, probe, onMapClick, onDraftChange, fitKey, flyTo, start }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const zoneLayer = useRef<LayerGroup | null>(null);
  const draftLayer = useRef<LayerGroup | null>(null);
  const probeLayer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const cb = useRef({ onMapClick, onDraftChange });
  useEffect(() => {
    cb.current = { onMapClick, onDraftChange };
  });

  // create the map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lib = await import("leaflet");
      if (cancelled || !box.current || map.current) return;
      L.current = lib;
      const m = lib.map(box.current, { zoomControl: true }).setView(start ? [start.lat, start.lng] : [22.5, 79], start ? 12 : 5);
      lib.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(m);
      zoneLayer.current = lib.layerGroup().addTo(m);
      draftLayer.current = lib.layerGroup().addTo(m);
      probeLayer.current = lib.layerGroup().addTo(m);
      m.on("click", (e) => cb.current.onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      drawZones();
      drawDraft();
      drawProbe();
      fit();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fit() {
    const lib = L.current;
    const m = map.current;
    if (!lib || !m) return;
    const pts: [number, number][] = [];
    for (const z of zones) {
      if (z.kind === "circle" && z.center && z.radiusM) {
        const b = lib.latLng(z.center.lat, z.center.lng).toBounds(z.radiusM * 2);
        pts.push([b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]);
      } else z.points.forEach((p) => pts.push([p.lat, p.lng]));
    }
    if (pts.length) m.fitBounds(lib.latLngBounds(pts), { padding: [24, 24], maxZoom: 15 });
  }

  function drawZones() {
    const lib = L.current;
    const g = zoneLayer.current;
    if (!lib || !g) return;
    g.clearLayers();
    for (const z of zones) {
      if (draft?.id === z.id) continue; // shown as the draft instead
      const style = z.active
        ? { color: z.color, weight: 2, fillColor: z.color, fillOpacity: 0.16 }
        : { color: "#8a958f", weight: 1.5, dashArray: "6 6", fillColor: "#8a958f", fillOpacity: 0.06 };
      const layer =
        z.kind === "circle" && z.center && z.radiusM
          ? lib.circle([z.center.lat, z.center.lng], { radius: z.radiusM, ...style, interactive: false })
          : z.points.length >= 3
            ? lib.polygon(
                z.points.map((p) => [p.lat, p.lng] as [number, number]),
                { ...style, interactive: false },
              )
            : null;
      if (!layer) continue;
      layer.addTo(g);
      if (z.center) {
        lib
          .marker([z.center.lat, z.center.lng], {
            interactive: false,
            icon: lib.divIcon({
              className: "",
              html: `<div style="transform:translate(-50%,-50%);white-space:nowrap;font:600 11px system-ui;color:#17231e;background:rgb(255 255 255/.9);padding:2px 6px;border-radius:999px;box-shadow:0 1px 3px rgb(0 0 0/.25)">${escapeHtml(z.name)}${z.active ? "" : " (off)"}</div>`,
            }),
          })
          .addTo(g);
      }
    }
  }

  function drawDraft() {
    const lib = L.current;
    const g = draftLayer.current;
    if (!lib || !g) return;
    g.clearLayers();
    if (!draft) return;
    const style = { color: draft.color, weight: 3, fillColor: draft.color, fillOpacity: 0.22 };
    if (draft.kind === "circle") {
      if (!draft.center) return;
      const circle = lib.circle([draft.center.lat, draft.center.lng], { radius: draft.radiusM, ...style, interactive: false }).addTo(g);
      const handle = lib
        .marker([draft.center.lat, draft.center.lng], { draggable: true, icon: lib.divIcon({ className: "", html: pinIcon(draft.color, 22), iconSize: [22, 22], iconAnchor: [11, 11] }) })
        .addTo(g);
      handle.bindTooltip("Drag to move the hub", { direction: "top", offset: [0, -12] });
      handle.on("drag", () => circle.setLatLng(handle.getLatLng()));
      handle.on("dragend", () => {
        const p = handle.getLatLng();
        cb.current.onDraftChange({ ...draft, center: { lat: p.lat, lng: p.lng } });
      });
      return;
    }
    const latlngs = draft.points.map((p) => [p.lat, p.lng] as [number, number]);
    const shape = draft.points.length >= 3 ? lib.polygon(latlngs, { ...style, interactive: false }).addTo(g) : lib.polyline(latlngs, { ...style, dashArray: "6 6", interactive: false }).addTo(g);
    draft.points.forEach((p, i) => {
      const h = lib
        .marker([p.lat, p.lng], { draggable: true, icon: lib.divIcon({ className: "", html: pinIcon(i === 0 ? "#1f4d3f" : draft.color, 16), iconSize: [16, 16], iconAnchor: [8, 8] }) })
        .addTo(g);
      h.bindTooltip(i === 0 ? "Start · drag to adjust" : "Drag to adjust · double-click to remove", { direction: "top", offset: [0, -8] });
      h.on("drag", () => {
        const next = draft.points.map((q, j) => (j === i ? h.getLatLng() : lib.latLng(q.lat, q.lng)));
        shape.setLatLngs(next);
      });
      h.on("dragend", () => {
        const ll = h.getLatLng();
        cb.current.onDraftChange({ ...draft, points: draft.points.map((q, j) => (j === i ? { lat: ll.lat, lng: ll.lng } : q)) });
      });
      h.on("dblclick", (e) => {
        lib.DomEvent.stop(e);
        cb.current.onDraftChange({ ...draft, points: draft.points.filter((_, j) => j !== i) });
      });
    });
  }

  function drawProbe() {
    const lib = L.current;
    const g = probeLayer.current;
    if (!lib || !g) return;
    g.clearLayers();
    if (!probe) return;
    lib
      .marker([probe.point.lat, probe.point.lng], {
        icon: lib.divIcon({ className: "", html: pinIcon(probe.covered ? "#1f7a4d" : "#b3362c", 20), iconSize: [20, 20], iconAnchor: [10, 10] }),
      })
      .addTo(g);
  }

  useEffect(drawZones, [zones, draft?.id]);  
  useEffect(drawDraft, [draft]);  
  // While outlining an area, a double-click would zoom and also add two corners; turn that off.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (draft?.kind === "polygon") m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
  }, [draft?.kind]);
  useEffect(drawProbe, [probe]);  
  useEffect(fit, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (flyTo && map.current) map.current.setView([flyTo.point.lat, flyTo.point.lng], flyTo.zoom);
  }, [flyTo]);

  return <div ref={box} className="relative z-0 h-full w-full" aria-label="Delivery areas map" />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
