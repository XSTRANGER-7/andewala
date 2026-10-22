"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatDistance, getCurrentPosition, type LatLng } from "@/lib/geo";
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

type Board = { ready: OrderView[]; mine: OrderView[]; done: OrderView[] };
type Plan = {
  stops: OrderView[];
  /** Distance of the leg into each stop, metres (null for stops without a map pin). */
  legs: (number | null)[];
  total: number;
  seconds: number | null;
  source: "road" | "straight";
  exact: boolean;
  line: LatLng[] | null;
  from: LatLng | null;
};

const pinOf = (o: OrderView): LatLng | null => (o.customer.lat !== null && o.customer.lng !== null ? { lat: o.customer.lat, lng: o.customer.lng } : null);
const paidOnline = (o: OrderView) => o.payment === "online" && o.paymentStatus === "paid";
const dirTo = (p: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;

/** Order the rider's stops for the shortest trip from where they are now. */
async function makePlan(from: LatLng | null, orders: OrderView[]): Promise<Plan> {
  const pinned = orders.filter((o) => pinOf(o));
  const unpinned = orders.filter((o) => !pinOf(o));
  if (!pinned.length) return { stops: unpinned, legs: unpinned.map(() => null), total: 0, seconds: null, source: "straight", exact: true, line: null, from };
  const pts = pinned.map((o) => pinOf(o)!);
  // Without the rider's location, plan from "anywhere": a start that is zero distance from every stop.
  const all = from ? [from, ...pts] : [pts[0], ...pts];
  const dm = await distanceMatrix(all);
  const matrix = from ? dm.matrix : dm.matrix.map((row, i) => row.map((d, j) => (i === 0 ? 0 : j === 0 ? 0 : d)));
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
  const line = await routeLine(from ? [from, ...ordered.map((o) => pinOf(o)!)] : ordered.map((o) => pinOf(o)!));
  return { stops: [...ordered, ...unpinned], legs: [...legs, ...unpinned.map(() => null)], total: plan.total, seconds, source: dm.source, exact: plan.exact, line, from };
}

export function RiderBoard({ riderName, board }: { riderName: string; board: Board }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [deliverFor, setDeliverFor] = useState<OrderView | null>(null);
  const [returnFor, setReturnFor] = useState<OrderView | null>(null);
  const planKey = board.mine.map((o) => o.id).sort().join(",");
  const posRef = useRef<LatLng | null>(null);

  // New orders and other riders' changes show up without reloading.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 45_000);
    return () => clearInterval(t);
  }, [router]);

  const locate = useCallback(async () => {
    const r = await getCurrentPosition({ timeout: 10_000, maximumAge: 30_000 });
    if (r.ok) {
      const p = { lat: r.pos.lat, lng: r.pos.lng };
      posRef.current = p;
      setPos(p);
      setGpsNote(null);
      return p;
    }
    setGpsNote("Turn on location so the route starts from where you are. Planning from the stops for now.");
    return posRef.current;
  }, []);

  const replan = useCallback(async () => {
    if (!board.mine.length) return setPlan(null);
    setPlanning(true);
    const from = await locate();
    setPlan(await makePlan(from, board.mine));
    setPlanning(false);
  }, [board.mine, locate]);

  // Plan whenever the set of orders in the run changes.
  useEffect(() => {
    const t = setTimeout(() => void replan(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

  const stops = plan?.stops.filter((o) => board.mine.some((m) => m.id === o.id)) ?? board.mine;
  const next = stops[0] ?? null;
  const mapStops = useMemo(() => stops.filter((o) => pinOf(o)).map((o) => ({ point: pinOf(o)!, label: `${o.customer.name} · ${o.trays} tray${o.trays > 1 ? "s" : ""}` })), [stops]);
  const navAll = mapStops.length ? googleMapsRoute(pos, mapStops.map((s) => s.point)) : null;

  async function start() {
    setBusy(true);
    const res = await startRunAction([...selected]);
    setBusy(false);
    toast(res.ok ? res.message : res.error, res.ok ? "default" : "error");
    setSelected(new Set());
    router.refresh();
  }

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = board.ready.length > 0 && board.ready.every((o) => selected.has(o.id));
  const collect = board.mine.filter((o) => !paidOnline(o)).reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Delivery partner</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Hi, {riderName.split(" ")[0]}</h1>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { n: board.ready.length, l: "Ready" },
            { n: board.mine.length, l: "On the way" },
            { n: board.done.length, l: "Delivered today" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-line bg-paper px-3 py-2">
              <div className="num font-display text-xl font-bold text-forest-900">{s.n}</div>
              <div className="text-[11px] text-ink-2">{s.l}</div>
            </div>
          ))}
        </div>
      </header>

      {/* the run */}
      <section className="grid gap-3" aria-label="My delivery run">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-bold">My delivery run</h2>
          {board.mine.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" loading={planning} onClick={() => void replan()}>
                Re-plan from here
              </Button>
              {navAll && (
                <a href={navAll} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg bg-forest-900 px-3 text-sm font-semibold text-white hover:bg-forest-800">
                  Navigate all stops
                </a>
              )}
            </div>
          )}
        </div>

        {board.mine.length === 0 ? (
          <p className="card text-sm text-ink-2">No orders out with you. Pick orders from the list below and tap <b>Start delivery run</b>.</p>
        ) : (
          <>
            <div className="card grid gap-1 py-3 text-sm" data-route-summary>
              <p>
                <b className="num">{board.mine.length}</b> stop{board.mine.length === 1 ? "" : "s"}
                {plan && plan.total > 0 && (
                  <>
                    {" · "}
                    <b className="num">{formatDistance(plan.total)}</b> {plan.source === "road" ? "by road" : "(approx.)"}
                    {plan.seconds ? <> · about <b className="num">{Math.max(1, Math.round(plan.seconds / 60))} min</b> riding</> : null}
                  </>
                )}
                {collect > 0 && (
                  <>
                    {" · "}collect <b className="num">{inr(collect)}</b> in cash/UPI
                  </>
                )}
              </p>
              <p className="text-xs text-ink-3">
                {planning ? "Planning the shortest route…" : plan ? `Stops are in the order that keeps the trip shortest${plan.exact ? " (best possible order)" : ""}${plan.from ? ", starting from where you are" : ""}.` : ""}
              </p>
              {gpsNote && <p className="text-xs text-warn">{gpsNote}</p>}
            </div>

            <div className="h-72 overflow-hidden rounded-2xl border border-line sm:h-96">
              <RiderMap rider={pos} stops={mapStops} line={plan?.line ?? null} />
            </div>

            {next && (
              <StopCard o={next} n={1} leg={plan?.legs[plan.stops.indexOf(next)] ?? null} highlight onDeliver={() => setDeliverFor(next)} onReturn={() => setReturnFor(next)} />
            )}
            {stops.slice(1).map((o, i) => (
              <StopCard key={o.id} o={o} n={i + 2} leg={plan?.legs[plan.stops.indexOf(o)] ?? null} onDeliver={() => setDeliverFor(o)} onReturn={() => setReturnFor(o)} />
            ))}
          </>
        )}
      </section>

      {/* ready to go */}
      <section className="grid gap-3" aria-label="Ready for delivery">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-bold">Ready for delivery</h2>
          {board.ready.length > 0 && (
            <button type="button" className="text-sm font-semibold text-forest-900 hover:underline" onClick={() => setSelected(allSelected ? new Set() : new Set(board.ready.map((o) => o.id)))}>
              {allSelected ? "Clear" : "Select all"}
            </button>
          )}
        </div>
        {board.ready.length === 0 ? (
          <p className="card text-sm text-ink-2">Nothing waiting. New orders for today show up here.</p>
        ) : (
          <ul className="grid gap-2">
            {board.ready.map((o) => (
              <li key={o.id}>
                <label className={cn("card flex cursor-pointer items-start gap-3 py-3 transition", selected.has(o.id) ? "border-forest-900 bg-mint-50" : "hover:border-ink-3")}>
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="mt-1 h-5 w-5 shrink-0 accent-forest-900" aria-label={`Select ${o.id}`} />
                  <OrderLines o={o} />
                </label>
              </li>
            ))}
          </ul>
        )}
        {board.ready.length > 0 && (
          <div className="sticky bottom-16 z-10 lg:bottom-4">
            <Button type="button" variant="sage" size="lg" className="w-full shadow-float" disabled={!selected.size} loading={busy} onClick={start}>
              {selected.size ? `Start delivery run (${selected.size})` : "Select orders to deliver"}
            </Button>
          </div>
        )}
      </section>

      {board.done.length > 0 && (
        <section className="grid gap-2" aria-label="Delivered today">
          <h2 className="font-display text-xl font-bold">Delivered today</h2>
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

      {deliverFor && (
        <DeliverDialog
          o={deliverFor}
          onClose={() => setDeliverFor(null)}
          onDone={(msg) => {
            setDeliverFor(null);
            toast(msg);
            router.refresh();
          }}
        />
      )}
      {returnFor && (
        <ReturnDialog
          o={returnFor}
          onClose={() => setReturnFor(null)}
          onDone={(msg) => {
            setReturnFor(null);
            toast(msg);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function OrderLines({ o }: { o: OrderView }) {
  const pin = pinOf(o);
  return (
    <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
      <span className="flex flex-wrap items-center gap-x-2">
        <b>{o.customer.name}</b>
        <span className="num text-xs text-ink-3">{o.id}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", paidOnline(o) ? "bg-good-soft text-good" : "bg-yolk-soft text-yolk-ink")}>
          {paidOnline(o) ? "Paid online" : `Collect ${inr(o.total)}`}
        </span>
      </span>
      <span className="text-ink-2">
        {o.customer.address}
        {o.customer.landmark ? `, near ${o.customer.landmark}` : ""} · {o.customer.pincode}
      </span>
      <span className="text-xs text-ink-3">
        {o.trays} tray{o.trays > 1 ? "s" : ""} · {fmtDay(o.date)}
        {o.notes ? ` · Note: ${o.notes}` : ""}
        {!pin && <b className="text-warn"> · No map pin, check the address</b>}
      </span>
    </span>
  );
}

function StopCard({ o, n, leg, highlight, onDeliver, onReturn }: { o: OrderView; n: number; leg: number | null; highlight?: boolean; onDeliver: () => void; onReturn: () => void }) {
  const pin = pinOf(o);
  return (
    <article className={cn("card grid gap-3", highlight && "border-2 border-yolk bg-yolk-soft/40")} data-stop={n} data-order={o.id}>
      <div className="flex items-start gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-lg font-bold", highlight ? "bg-yolk text-ink" : "bg-forest-900 text-white")}>{n}</span>
        <div className="min-w-0 flex-1">
          {highlight && <p className="eyebrow text-yolk-ink">Next stop{leg ? ` · ${formatDistance(leg)} away` : ""}</p>}
          {!highlight && leg ? <p className="text-xs text-ink-3">{formatDistance(leg)} after the previous stop</p> : null}
          <OrderLines o={o} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {pin && (
          <a href={dirTo(pin)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg bg-forest-900 px-4 text-sm font-semibold text-white hover:bg-forest-800">
            Navigate
          </a>
        )}
        <a href={`tel:+91${o.customer.phone}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold hover:bg-mint-50">
          Call {o.customer.name.split(" ")[0]}
        </a>
        <Button type="button" variant="sage" onClick={onDeliver} className="h-10">
          Mark delivered
        </Button>
        <button type="button" onClick={onReturn} className="h-10 rounded-lg px-3 text-sm font-semibold text-ink-3 hover:bg-mint-50 hover:text-bad">
          Couldn&apos;t deliver
        </button>
      </div>
    </article>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-3 sm:place-items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="grid w-full max-w-md gap-3 rounded-2xl bg-paper p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function DeliverDialog({ o, onClose, onDone }: { o: OrderView; onClose: () => void; onDone: (msg: string) => void }) {
  const online = paidOnline(o);
  const [code, setCode] = useState("");
  const [cash, setCash] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await deliverAction(o.id, online ? { code } : { cashCollected: cash });
    setBusy(false);
    if (r.ok) onDone(r.message);
    else setError(r.error);
  }
  return (
    <Dialog title={`Deliver to ${o.customer.name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        {online ? (
          <label className="grid gap-1.5 text-sm">
            <span>
              Paid online. Ask the customer for their <b>4-digit delivery code</b> (shown on their order page).
            </span>
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="input num text-center text-2xl tracking-[0.5em]"
              placeholder="••••"
              aria-label="Delivery code"
            />
          </label>
        ) : (
          <label className="flex items-start gap-2 rounded-lg bg-yolk-soft px-3 py-2.5 text-sm">
            <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} className="mt-0.5 h-5 w-5 accent-forest-900" />
            <span>
              I collected <b className="num">{inr(o.total)}</b> in cash or UPI.
            </span>
          </label>
        )}
        {error && <Note tone="bad">{error}</Note>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="sage" loading={busy} disabled={online ? code.length !== 4 : !cash}>
            Confirm delivery
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const REASONS = ["Customer not available", "Wrong or incomplete address", "Customer refused the order", "Other"];

function ReturnDialog({ o, onClose, onDone }: { o: OrderView; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog title="Couldn't deliver?" onClose={onClose}>
      <p className="text-sm text-ink-2">The order goes back to the ready list so it can be delivered later.</p>
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
            const r = await returnOrderAction(o.id, reason);
            setBusy(false);
            if (r.ok) onDone(r.message);
            else setError(r.error);
          }}
        >
          Return order
        </Button>
      </div>
    </Dialog>
  );
}
