"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { distanceMeters, formatDistance, getCurrentPosition, type LatLng } from "@/lib/geo";
import { inr } from "@/lib/money";
import { distanceMatrix, googleMapsRoute, routeLine } from "@/lib/osrm";
import { planRoute } from "@/lib/route";
import { fmtDay, fmtWhen } from "@/lib/time";
import type { OrderView } from "@/lib/types";
import { deliverAction, returnOrderAction, startRunAction } from "@/server/actions/rider";

const RiderMap = dynamic(() => import("./RiderMap").then((m) => m.RiderMap), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-mint-100 text-sm text-ink-3">Loading map…</div>,
});

type Board = { ready: OrderView[]; run: OrderView[]; done: OrderView[] };
type Plan = {
  stops: OrderView[];
  /** Distance into each stop, metres (null without a pin). */
  legs: (number | null)[];
  total: number;
  seconds: number | null;
  source: "road" | "straight";
  exact: boolean;
  line: LatLng[] | null;
};

const pinOf = (o: OrderView): LatLng | null => (o.customer.lat !== null && o.customer.lng !== null ? { lat: o.customer.lat, lng: o.customer.lng } : null);
const isPaid = (o: OrderView) => o.paymentStatus === "paid";
const dirTo = (p: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;

/**
 * Best order to visit `orders` starting at `from` (shortest total distance:
 * exact up to 12 stops, near-best above). Stops without a map pin go last.
 */
async function makePlan(from: LatLng | null, orders: OrderView[], withLine = true): Promise<Plan> {
  const pinned = orders.filter((o) => pinOf(o));
  const unpinned = orders.filter((o) => !pinOf(o));
  if (!pinned.length) return { stops: unpinned, legs: unpinned.map(() => null), total: 0, seconds: null, source: "straight", exact: true, line: null };
  const pts = pinned.map((o) => pinOf(o)!);
  // No starting point: plan from "anywhere" (a start that is zero distance from every stop).
  const all = from ? [from, ...pts] : [pts[0], ...pts];
  const dm = await distanceMatrix(all);
  const matrix = from ? dm.matrix : dm.matrix.map((row, i) => row.map((d, j) => (i === 0 || j === 0 ? 0 : d)));
  const plan = planRoute(matrix);
  const ordered = plan.order.map((i) => pinned[i - 1]);
  const legs: (number | null)[] = [];
  let prev = 0;
  let seconds: number | null = dm.durations ? 0 : null;
  for (const i of plan.order) {
    legs.push(from || prev !== 0 ? matrix[prev][i] : 0);
    if (seconds !== null && dm.durations && (from || prev !== 0)) seconds += dm.durations[prev][i];
    prev = i;
  }
  const line = withLine ? await routeLine(from ? [from, ...ordered.map((o) => pinOf(o)!)] : ordered.map((o) => pinOf(o)!)) : null;
  return { stops: [...ordered, ...unpinned], legs: [...legs, ...unpinned.map(() => null)], total: plan.total, seconds, source: dm.source, exact: plan.exact, line };
}

const mins = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : null);

export function RiderBoard({ riderName, board }: { riderName: string; board: Board }) {
  const router = useRouter();
  const [pos, setPos] = useState<LatLng | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [finished, setFinished] = useState<number>(0);
  const hadRun = useRef(board.run.length > 0);

  // New orders and other riders' changes show up without reloading.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 45_000);
    return () => clearInterval(t);
  }, [router]);

  const locate = useCallback(async (): Promise<LatLng | null> => {
    const r = await getCurrentPosition({ timeout: 10_000, maximumAge: 30_000 });
    if (r.ok) {
      const p = { lat: r.pos.lat, lng: r.pos.lng };
      setPos(p);
      setGpsNote(null);
      return p;
    }
    setGpsNote("Turn on location so routes start from where you are.");
    return null;
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void locate(), 0);
    return () => clearTimeout(t);
  }, [locate]);

  // A run that just emptied out: celebrate, then back to the order list.
  useEffect(() => {
    if (board.run.length > 0) hadRun.current = true;
    else if (hadRun.current) {
      hadRun.current = false;
      const t = setTimeout(() => setFinished(board.done.length), 0);
      return () => clearTimeout(t);
    }
  }, [board.run.length, board.done.length]);

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-3 gap-2 text-center" data-rider-stats>
        {[
          { n: board.ready.length, l: "To deliver" },
          { n: board.run.length, l: "In my run" },
          { n: board.done.length, l: "Delivered today" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-line bg-paper px-3 py-2">
            <div className="num font-display text-xl font-bold text-forest-900">{s.n}</div>
            <div className="text-[11px] text-ink-2">{s.l}</div>
          </div>
        ))}
      </div>
      {gpsNote && <p className="text-xs text-warn">{gpsNote}</p>}
      {finished > 0 && board.run.length === 0 && (
        <Note tone="good">
          <b>Run complete.</b> All stops delivered. Pick up the next orders below when you&apos;re ready.
        </Note>
      )}

      {board.run.length > 0 ? (
        <ActiveRun run={board.run} pos={pos} locate={locate} riderName={riderName} />
      ) : planning ? (
        <PlanRun ready={board.ready} pos={pos} locate={locate} onCancel={() => setPlanning(false)} onStarted={() => setPlanning(false)} />
      ) : (
        <Overview ready={board.ready} pos={pos} onStart={() => { setFinished(0); setPlanning(true); }} />
      )}

      {board.done.length > 0 && (
        <section className="grid gap-2" aria-label="Delivered today">
          <h2 className="font-display text-lg font-bold">Delivered today</h2>
          <ul className="grid gap-2">
            {board.done.map((o) => (
              <li key={o.id} className="card flex items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0">
                  <b className="num">{o.id}</b> · {o.customer.name}
                  <span className="block truncate text-xs text-ink-3">{o.customer.address}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-good">✓ {o.deliveredAt ? fmtWhen(o.deliveredAt) : "Delivered"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------------- 1. all orders waiting ---------------- */

function Overview({ ready, pos, onStart }: { ready: OrderView[]; pos: LatLng | null; onStart: () => void }) {
  const sorted = useMemo(
    () =>
      [...ready].sort((a, b) => {
        const pa = pinOf(a), pb = pinOf(b);
        if (!pos || !pa || !pb) return pa ? -1 : pb ? 1 : 0;
        return distanceMeters(pos, pa) - distanceMeters(pos, pb);
      }),
    [ready, pos],
  );
  return (
    <section className="grid gap-3" aria-label="Orders to deliver">
      <h2 className="font-display text-xl font-bold">Orders to deliver</h2>
      {sorted.length === 0 ? (
        <p className="card text-sm text-ink-2">Nothing waiting. New orders for today show up here.</p>
      ) : (
        <ul className="grid gap-2">
          {sorted.map((o) => {
            const p = pinOf(o);
            return (
              <li key={o.id} className="card py-3" data-ready={o.id}>
                <OrderLines o={o} extra={pos && p ? `${formatDistance(distanceMeters(pos, p))} from you` : null} />
              </li>
            );
          })}
        </ul>
      )}
      {sorted.length > 0 && (
        <div className="sticky bottom-3 z-10">
          <Button type="button" variant="sage" size="lg" className="w-full shadow-float" onClick={onStart}>
            Start delivery
          </Button>
        </div>
      )}
    </section>
  );
}

/* ---------------- 2. the ranked plan ---------------- */

function PlanRun({ ready, pos, locate, onCancel, onStarted }: { ready: OrderView[]; pos: LatLng | null; locate: () => Promise<LatLng | null>; onCancel: () => void; onStarted: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const included = useMemo(() => ready.filter((o) => !excluded.has(o.id)), [ready, excluded]);
  const key = included.map((o) => o.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setPlan(null);
      const from = pos ?? (await locate());
      const p = await makePlan(from, included);
      if (!cancelled) setPlan(p);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // re-plan when the chosen orders change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggle = (id: string) => setExcluded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function start() {
    if (!plan) return;
    setBusy(true);
    const res = await startRunAction(plan.stops.map((o) => o.id));
    setBusy(false);
    toast(res.ok ? res.message : res.error, res.ok ? "default" : "error");
    if (res.ok) onStarted();
    router.refresh();
  }

  const mapStops = plan ? plan.stops.filter((o) => pinOf(o)).map((o) => ({ point: pinOf(o)!, label: `${o.customer.name}` })) : [];
  return (
    <section className="grid gap-3" aria-label="Plan the run">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Best order for your run</h2>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink-3 hover:text-ink">
          Back
        </button>
      </div>
      <div className="card grid gap-1 py-3 text-sm" data-route-summary>
        {plan ? (
          <>
            <p>
              <b className="num">{plan.stops.length}</b> stop{plan.stops.length === 1 ? "" : "s"}
              {plan.total > 0 && (
                <>
                  {" · "}
                  <b className="num">{formatDistance(plan.total)}</b> {plan.source === "road" ? "by road" : "(approx.)"}
                  {mins(plan.seconds) && <> · about <b className="num">{mins(plan.seconds)}</b> riding</>}
                </>
              )}
            </p>
            <p className="text-xs text-ink-3">Ranked to keep your trip shortest{plan.exact ? " (best possible order)" : ""}. Untick an order to leave it out; the ranking updates.</p>
          </>
        ) : (
          <p className="text-ink-2">Working out the shortest route…</p>
        )}
      </div>
      <div className="h-64 overflow-hidden rounded-2xl border border-line sm:h-80">
        <RiderMap rider={pos} stops={mapStops} line={plan?.line ?? null} />
      </div>
      <ol className="grid gap-2">
        {(plan?.stops ?? []).map((o, i) => (
          <li key={o.id} data-rank={i + 1} data-order={o.id}>
            <label className="card flex cursor-pointer items-start gap-3 py-3">
              <input type="checkbox" checked onChange={() => toggle(o.id)} className="mt-1.5 h-5 w-5 shrink-0 accent-forest-900" aria-label={`Include ${o.id}`} />
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest-900 font-display font-bold text-white">{i + 1}</span>
              <OrderLines o={o} extra={plan?.legs[i] ? `${formatDistance(plan.legs[i]!)} ${i === 0 ? "from you" : "after the previous stop"}` : null} />
            </label>
          </li>
        ))}
      </ol>
      {excluded.size > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Not in this run</p>
          {ready.filter((o) => excluded.has(o.id)).map((o) => (
            <label key={o.id} className="card flex cursor-pointer items-start gap-3 py-3 opacity-70">
              <input type="checkbox" checked={false} onChange={() => toggle(o.id)} className="mt-1 h-5 w-5 shrink-0 accent-forest-900" aria-label={`Include ${o.id}`} />
              <OrderLines o={o} />
            </label>
          ))}
        </div>
      )}
      <div className="sticky bottom-3 z-10">
        <Button type="button" variant="sage" size="lg" className="w-full shadow-float" disabled={!plan || !plan.stops.length} loading={busy} onClick={start}>
          {plan ? `Start run · ${plan.stops.length} stop${plan.stops.length === 1 ? "" : "s"}` : "Planning…"}
        </Button>
      </div>
    </section>
  );
}

/* ---------------- 3. one stop at a time ---------------- */

function ActiveRun({ run, pos, locate, riderName }: { run: OrderView[]; pos: LatLng | null; locate: () => Promise<LatLng | null>; riderName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const current = run[0];
  const rest = run.slice(1);
  const here = pinOf(current);
  const [code, setCode] = useState("");
  const [cash, setCash] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  /** The remaining stops re-planned from this stop (where the rider will be after handing it over). */
  const [after, setAfter] = useState<Plan | null>(null);
  const [toHere, setToHere] = useState<Plan | null>(null);
  const restKey = rest.map((o) => o.id).join(",");

  // Reset the form for each new stop.
  useEffect(() => {
    const t = setTimeout(() => {
      setCode("");
      setCash(false);
      setError(null);
    }, 0);
    return () => clearTimeout(t);
  }, [current.id]);

  // Plan the rest of the run from this stop, so the next stop is the cheapest one from here.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const p = rest.length ? await makePlan(here ?? pos, rest, false) : null;
      if (!cancelled) setAfter(p);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id, restKey]);

  // Distance and route from the rider to this stop.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const from = pos ?? (await locate());
      const p = from && here ? await makePlan(from, [current]) : null;
      if (!cancelled) setToHere(p);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id, pos?.lat, pos?.lng]);

  const upNext = after ? after.stops : rest;
  const nextIds = upNext.map((o) => o.id);
  const paid = isPaid(current);
  const mapStops = [current, ...upNext].filter((o) => pinOf(o)).map((o) => ({ point: pinOf(o)!, label: o.customer.name }));
  const navAll = mapStops.length ? googleMapsRoute(pos, mapStops.map((s) => s.point)) : null;

  async function deliver(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await deliverAction(current.id, { code, cashCollected: cash }, nextIds);
    setBusy(false);
    if (!r.ok) return setError({ text: r.error, field: r.field });
    toast(r.message);
    router.refresh();
  }

  return (
    <section className="grid gap-3" aria-label="Delivery run">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">
          Stop 1 <span className="text-ink-3">of {run.length}</span>
        </h2>
        {navAll && (
          <a href={navAll} target="_blank" rel="noreferrer" className="text-sm font-semibold text-forest-900 hover:underline">
            Navigate whole run
          </a>
        )}
      </div>

      <article className="card grid gap-4 border-2 border-yolk bg-yolk-soft/40" data-current={current.id}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-yolk font-display text-lg font-bold text-ink">1</span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-yolk-ink">
              Now delivering{toHere?.total ? ` · ${formatDistance(toHere.total)} away` : ""}
              {mins(toHere?.seconds ?? null) ? ` · ${mins(toHere!.seconds)}` : ""}
            </p>
            <OrderLines o={current} />
            <p className="mt-1 text-xs text-ink-3">The customer sees &ldquo;Out for delivery&rdquo; and has the delivery code.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {here && (
            <a href={dirTo(here)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-lg bg-forest-900 px-4 text-sm font-semibold text-white hover:bg-forest-800">
              Navigate
            </a>
          )}
          <a href={`tel:+91${current.customer.phone}`} className="inline-flex h-11 items-center justify-center rounded-lg border border-line bg-paper px-4 text-sm font-semibold hover:bg-mint-50">
            Call {current.customer.name.split(" ")[0]}
          </a>
        </div>
        <form onSubmit={deliver} className="grid gap-3 rounded-xl bg-paper p-3 ring-1 ring-line">
          <label className="grid gap-1.5 text-sm">
            <span>
              At the door? Ask <b>{current.customer.name.split(" ")[0]}</b> for the <b>4-digit delivery code</b> on their order page.
            </span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className={cn("input num text-center text-2xl tracking-[0.5em]", error?.field === "code" && "border-bad")}
              placeholder="••••"
              aria-label="Delivery code"
            />
          </label>
          {!paid && (
            <label className="flex items-start gap-2 rounded-lg bg-yolk-soft px-3 py-2.5 text-sm">
              <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} className="mt-0.5 h-5 w-5 accent-forest-900" />
              <span>
                I collected <b className="num">{inr(current.total)}</b> in cash or UPI.
              </span>
            </label>
          )}
          {error && <Note tone="bad">{error.text}</Note>}
          <Button type="submit" variant="sage" size="lg" loading={busy} disabled={code.length !== 4 || (!paid && !cash)}>
            Confirm delivery
          </Button>
          <button type="button" onClick={() => setReturning(true)} className="text-sm font-semibold text-ink-3 hover:text-bad">
            Couldn&apos;t deliver this one
          </button>
        </form>
      </article>

      <div className="h-60 overflow-hidden rounded-2xl border border-line sm:h-72">
        <RiderMap rider={pos} stops={mapStops} line={null} />
      </div>

      {upNext.length > 0 && (
        <section className="grid gap-2" aria-label="Up next">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Up next{after ? " · shortest order from this stop" : ""}</h3>
          <ol className="grid gap-2">
            {upNext.map((o, i) => (
              <li key={o.id} className="card flex items-start gap-3 py-3" data-next-rank={i + 2} data-order={o.id}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest-900 font-display font-bold text-white">{i + 2}</span>
                <OrderLines o={o} extra={after?.legs[i] ? `${formatDistance(after.legs[i]!)} after the previous stop` : null} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {returning && (
        <ReturnDialog
          o={current}
          nextIds={nextIds}
          onClose={() => setReturning(false)}
          onDone={(msg) => {
            setReturning(false);
            toast(msg);
            router.refresh();
          }}
        />
      )}
      <span className="sr-only">Rider {riderName}</span>
    </section>
  );
}

function OrderLines({ o, extra }: { o: OrderView; extra?: string | null }) {
  const pin = pinOf(o);
  return (
    <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
      <span className="flex flex-wrap items-center gap-x-2">
        <b>{o.customer.name}</b>
        <span className="num text-xs text-ink-3">{o.id}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", isPaid(o) ? "bg-good-soft text-good" : "bg-yolk-soft text-yolk-ink")}>
          {isPaid(o) ? "Paid online" : `Collect ${inr(o.total)}`}
        </span>
      </span>
      <span className="text-ink-2">
        {o.customer.address}
        {o.customer.landmark ? `, near ${o.customer.landmark}` : ""} · {o.customer.pincode}
      </span>
      <span className="text-xs text-ink-3">
        {o.trays} tray{o.trays > 1 ? "s" : ""} · {fmtDay(o.date)}
        {o.notes ? ` · Note: ${o.notes}` : ""}
        {extra ? ` · ${extra}` : ""}
        {!pin && <b className="text-warn"> · No map pin, check the address</b>}
      </span>
    </span>
  );
}

const REASONS = ["Customer not available", "Wrong or incomplete address", "Customer refused the order", "Other"];

function ReturnDialog({ o, nextIds, onClose, onDone }: { o: OrderView; nextIds: string[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-3 sm:place-items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Couldn't deliver" className="grid w-full max-w-md gap-3 rounded-2xl bg-paper p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">Couldn&apos;t deliver?</h2>
        <p className="text-sm text-ink-2">The order goes back to the list for later, and your next stop starts.</p>
        <div className="grid gap-2" role="radiogroup" aria-label="Reason">
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-forest-900" />
              {r}
            </label>
          ))}
        </div>
        {error && <Note tone="bad">{error}</Note>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Keep it
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const r = await returnOrderAction(o.id, reason, nextIds);
              setBusy(false);
              if (r.ok) onDone(r.message);
              else setError(r.error);
            }}
          >
            Return order
          </Button>
        </div>
      </div>
    </div>
  );
}
