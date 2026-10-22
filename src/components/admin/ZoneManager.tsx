"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { getCurrentPosition, locateErrorText, type LatLng } from "@/lib/geo";
import { zonesAt, type Zone } from "@/lib/zones";
import { deleteZoneAction, saveZoneAction } from "@/server/actions/admin";
import type { Draft } from "./ZoneMap";

const ZoneMap = dynamic(() => import("./ZoneMap").then((m) => m.ZoneMap), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-mint-100 text-sm text-ink-3">Loading map…</div>,
});

const COLORS = ["#2f7d5b", "#1f6fb2", "#c26a00", "#8b46c7", "#c23a6b", "#4c7a12"];

type Mode = "idle" | "draft" | "probe";

/** Admin: draw, edit, switch off and remove delivery areas on a map. */
export function ZoneManager({ zones, start, pincodes }: { zones: Zone[]; start: LatLng | null; pincodes: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [probe, setProbe] = useState<LatLng | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [flyTo, setFlyTo] = useState<{ point: LatLng; zoom: number; key: number } | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  /** The km box's own text while typing, so "2." or an empty box don't get rewritten mid-edit. */
  const [kmText, setKmText] = useState<string | null>(null);

  const active = zones.filter((z) => z.active);
  const probeHits = useMemo(() => (probe ? zonesAt(zones, probe) : []), [probe, zones]);

  function newDraft(kind: "circle" | "polygon") {
    setErrors({});
    setProbe(null);
    setMode("draft");
    setKmText(null);
    setDraft({ name: "", kind, center: null, radiusM: 3000, points: [], active: true, color: COLORS[zones.length % COLORS.length] });
  }

  function edit(z: Zone) {
    setErrors({});
    setProbe(null);
    setMode("draft");
    setKmText(null);
    setDraft({ id: z.id, name: z.name, kind: z.kind, center: z.kind === "circle" ? z.center : null, radiusM: z.radiusM ?? 3000, points: z.points, active: z.active, color: z.color });
    if (z.center) setFlyTo({ point: z.center, zoom: z.kind === "circle" ? zoomFor(z.radiusM ?? 3000) : 14, key: Date.now() });
  }

  function cancel() {
    setDraft(null);
    setMode("idle");
    setErrors({});
  }

  function onMapClick(p: LatLng) {
    if (mode === "probe") return setProbe(p);
    if (mode !== "draft" || !draft) return;
    setErrors({});
    if (draft.kind === "circle") setDraft({ ...draft, center: p });
    else setDraft({ ...draft, points: [...draft.points, p] });
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const res = await saveZoneAction({
        id: draft.id,
        name: draft.name,
        kind: draft.kind,
        center: draft.kind === "circle" ? draft.center : null,
        radiusM: draft.kind === "circle" ? Math.round(draft.radiusM) : null,
        points: draft.kind === "polygon" ? draft.points : [],
        active: draft.active,
        color: draft.color,
      });
      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
      toast(res.message);
      cancel();
      router.refresh();
      setFitKey((k) => k + 1);
    });
  }

  function toggle(z: Zone) {
    startTransition(async () => {
      const res = await saveZoneAction({ id: z.id, name: z.name, kind: z.kind, center: z.kind === "circle" ? z.center : null, radiusM: z.radiusM, points: z.points, active: !z.active, color: z.color });
      toast(res.ok ? (z.active ? `"${z.name}" switched off` : `"${z.name}" switched on`) : (res.errors.form ?? Object.values(res.errors)[0] ?? "That didn't save."), res.ok ? "default" : "error");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteZoneAction(id);
      toast(res.ok ? res.message : (res.errors.form ?? "That didn't save."), res.ok ? "default" : "error");
      setConfirmDelete(null);
      if (draft?.id === id) cancel();
      router.refresh();
    });
  }

  async function goToPlace(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (hit) setFlyTo({ point: { lat: Number(hit.lat), lng: Number(hit.lon) }, zoom: 15, key: Date.now() });
      else toast("Place not found. Try a nearby landmark or PIN code.", "error");
    } catch {
      toast("Search didn't work. Check your connection.", "error");
    } finally {
      setSearching(false);
    }
  }

  async function goToMe() {
    const r = await getCurrentPosition({ timeout: 10_000, maximumAge: 0 });
    if (!r.ok) return toast(locateErrorText(r.error), "error");
    setFlyTo({ point: { lat: r.pos.lat, lng: r.pos.lng }, zoom: 15, key: Date.now() });
  }

  const hint =
    mode === "probe"
      ? "Click anywhere on the map to check whether we deliver there."
      : draft?.kind === "circle"
        ? draft.center
          ? "Drag the dot to move the hub. Set the radius on the right."
          : "Click the map where the hub (shop or godown) is."
        : draft?.kind === "polygon"
          ? draft.points.length < 3
            ? `Click around the area to outline it (${draft.points.length}/3 points so far).`
            : "Keep clicking to add corners. Drag a corner to adjust; double-click a corner to remove it."
          : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* map */}
      <div className="grid content-start gap-2 self-start">
        <div className="flex flex-wrap gap-2">
          <form onSubmit={goToPlace} className="flex min-w-0 flex-1 gap-2">
            <input className="input min-w-0 flex-1" placeholder="Go to a place, area or PIN code…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search a place" />
            <Button type="submit" variant="outline" loading={searching}>
              Go
            </Button>
          </form>
          <Button type="button" variant="outline" onClick={goToMe}>
            My location
          </Button>
          {zones.length > 0 && (
            <Button type="button" variant="outline" onClick={() => setFitKey((k) => k + 1)}>
              Show all
            </Button>
          )}
        </div>
        {hint && <p className="rounded-lg bg-yolk-soft px-3 py-2 text-sm font-medium text-yolk-ink">{hint}</p>}
        <div className={cn("relative h-[55vh] min-h-80 overflow-hidden rounded-2xl border border-line lg:h-[68vh]", mode !== "idle" && "ring-2 ring-forest-900/40")}>
          <ZoneMap zones={zones} draft={draft} probe={probe ? { point: probe, covered: probeHits.length > 0 } : null} onMapClick={onMapClick} onDraftChange={setDraft} fitKey={fitKey} flyTo={flyTo} start={start} />
        </div>
        {probe && (
          <Note tone={probeHits.length ? "good" : "bad"}>
            {probeHits.length ? (
              <>
                <b>We deliver here.</b> Inside {probeHits.map((z) => `"${z.name}"`).join(" and ")}
                {probeHits.length > 1 ? " (shared area, the nearest hub is listed first)." : "."}
              </>
            ) : (
              <>
                <b>Outside every active delivery area.</b> Customers here can&apos;t save this address or order.
              </>
            )}
          </Note>
        )}
      </div>

      {/* side panel */}
      <div className="grid content-start gap-4">
        {draft ? (
          <section className="card grid gap-3" aria-label={draft.id ? "Edit area" : "New area"}>
            <h2 className="font-display text-lg font-bold">{draft.id ? "Edit area" : draft.kind === "circle" ? "New circle around a hub" : "New custom area"}</h2>
            <label className="grid gap-1 text-sm font-semibold">
              Name
              <input className="input" placeholder={draft.kind === "circle" ? "e.g. Hub 1 · Model Town" : "e.g. Civil Lines"} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              {errors.name && <span className="text-xs font-normal text-bad">{errors.name}</span>}
            </label>
            {draft.kind === "circle" && (
              <label className="grid gap-1 text-sm font-semibold">
                Radius: <span className="num font-bold text-forest-900">{(draft.radiusM / 1000).toFixed(1)} km</span>
                <input
                  type="range"
                  min={200}
                  max={20000}
                  step={100}
                  value={Math.min(20000, draft.radiusM)}
                  onChange={(e) => {
                    setKmText(null);
                    setDraft({ ...draft, radiusM: Number(e.target.value) });
                  }}
                  className="accent-forest-900"
                  aria-label="Radius"
                />
                <span className="flex items-center gap-2 text-xs font-normal text-ink-3">
                  or type
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input num w-24 py-1"
                    value={kmText ?? (draft.radiusM / 1000).toString()}
                    onChange={(e) => {
                      const v = e.target.value.replace(",", ".");
                      if (!/^\d*\.?\d*$/.test(v)) return;
                      setKmText(v);
                      const n = Number(v);
                      if (v && Number.isFinite(n) && n > 0) setDraft({ ...draft, radiusM: Math.round(n * 1000) });
                    }}
                    onBlur={() => setKmText(null)}
                    aria-label="Radius in kilometres"
                  />
                  km
                </span>
                {(errors.radiusM || errors.center) && <span className="text-xs font-normal text-bad">{errors.radiusM || errors.center}</span>}
              </label>
            )}
            {draft.kind === "polygon" && (
              <div className="grid gap-2 text-sm">
                <p className="text-ink-2">
                  <b className="num">{draft.points.length}</b> corner{draft.points.length === 1 ? "" : "s"}
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={!draft.points.length} onClick={() => setDraft({ ...draft, points: draft.points.slice(0, -1) })}>
                    Undo last point
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={!draft.points.length} onClick={() => setDraft({ ...draft, points: [] })}>
                    Clear
                  </Button>
                </div>
                {errors.points && <span className="text-xs text-bad">{errors.points}</span>}
              </div>
            )}
            <div className="grid gap-1 text-sm font-semibold">
              Colour
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={cn("h-7 w-7 rounded-full ring-offset-2 transition", draft.color === c && "ring-2 ring-ink")}
                    style={{ background: c }}
                    aria-label={`Colour ${c}`}
                    aria-pressed={draft.color === c}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-forest-900" />
              Deliver in this area (switch off to pause it without deleting)
            </label>
            {errors.form && <Note tone="bad">{errors.form}</Note>}
            <div className="flex gap-2">
              <Button type="button" variant="sage" loading={pending} onClick={save}>
                {draft.id ? "Save area" : "Add area"}
              </Button>
              <Button type="button" variant="outline" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </section>
        ) : (
          <section className="card grid gap-3">
            <h2 className="font-display text-lg font-bold">Add a delivery area</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Button type="button" variant="sage" onClick={() => newDraft("circle")}>
                + Circle around a hub
              </Button>
              <Button type="button" variant="outline" onClick={() => newDraft("polygon")}>
                + Draw a custom area
              </Button>
              <Button type="button" variant={mode === "probe" ? "primary" : "outline"} onClick={() => { setMode(mode === "probe" ? "idle" : "probe"); setProbe(null); }}>
                {mode === "probe" ? "Stop checking" : "Check a location"}
              </Button>
            </div>
            <p className="text-xs text-ink-3">Areas can overlap: a place inside two hubs&apos; circles is covered once. Customers can save an address or order only inside an active area.</p>
          </section>
        )}

        <section className="card grid gap-2" aria-label="Delivery areas">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">Areas</h2>
            <span className="text-xs text-ink-3">{active.length} active</span>
          </div>
          {zones.length === 0 ? (
            <p className="text-sm text-ink-2">
              No areas yet.{" "}
              {pincodes.length ? `Until you add one, delivery is limited to PIN codes ${pincodes.join(", ")} (Delivery settings).` : "Until you add one, customers can order from anywhere."}
            </p>
          ) : (
            <ul className="grid gap-2">
              {zones.map((z) => (
                <li key={z.id} className={cn("grid gap-2 rounded-xl border px-3 py-2.5", draft?.id === z.id ? "border-forest-900 bg-mint-50" : "border-line")}>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: z.active ? z.color : "#a5ada9" }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{z.name}</span>
                    <span className="shrink-0 text-xs text-ink-3">{z.kind === "circle" ? `${((z.radiusM ?? 0) / 1000).toFixed(1)} km circle` : `${z.points.length}-point area`}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={z.active} disabled={pending} onChange={() => toggle(z)} className="h-4 w-4 accent-forest-900" />
                      {z.active ? "On" : "Off"}
                    </label>
                    <button type="button" className="text-forest-900 hover:underline" onClick={() => edit(z)}>
                      Edit
                    </button>
                    {confirmDelete === z.id ? (
                      <span className="flex items-center gap-2">
                        <span className="text-bad">Remove?</span>
                        <button type="button" className="text-bad hover:underline" disabled={pending} onClick={() => remove(z.id)}>
                          Yes, remove
                        </button>
                        <button type="button" className="text-ink-3 hover:underline" onClick={() => setConfirmDelete(null)}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="text-ink-3 hover:text-bad" onClick={() => setConfirmDelete(z.id)}>
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** A zoom level that fits a circle of this radius. */
function zoomFor(radiusM: number) {
  return Math.max(9, Math.min(16, Math.round(15 - Math.log2(radiusM / 700))));
}
