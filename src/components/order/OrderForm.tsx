"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EggTray } from "@/components/art/EggTray";
import { Button } from "@/components/ui/Button";
import { Choice } from "@/components/ui/Choice";
import { Field } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { Stepper } from "@/components/ui/Stepper";
import { IconPin } from "@/components/ui/Icons";
import { ClosedButton } from "@/components/store/StoreStatus";
import { useToast } from "@/components/ui/Toast";
import { inr } from "@/lib/money";
import { deliveryFeeFor } from "@/lib/pricing";
import { fmtTime } from "@/lib/time";
import type { Availability } from "@/lib/types";

/** The ways to pay at checkout. */
type Pay = "cod" | "online";
import { confirmPaymentAction, paymentFailedAction, placeOrderAction, startPaymentAction } from "@/server/actions/order";
import { payWithRazorpay } from "@/lib/razorpay-checkout";
import { clearDraft, readDraft, setCartTrays, writeDraft } from "@/lib/cart";
import { AddressBook } from "@/components/account/AddressBook";
import type { AddressView } from "@/server/accounts";
import { distanceMeters, formatDistance, getCurrentPosition } from "@/lib/geo";

export type CheckoutAccount = { addresses: AddressView[]; defaults: { name: string; phone: string } };

/**
 * Resolve the user's preferred day/slot against live availability: keep the
 * choice while it is still open, otherwise fall back to the first open option.
 */
function resolveChoice(a: Availability, wantDate: string | null, wantSlot: string | null) {
  const day = a.days.find((d) => d.date === wantDate && d.open) ?? a.days.find((d) => d.open) ?? a.days[0];
  const slot = day?.slots.find((s) => s.id === wantSlot && s.ok) ?? day?.slots.find((s) => s.ok);
  return { day, slot };
}

const subscribeNoop = () => () => {};

/**
 * Checkout for the cart. The tray count comes from the cart (`trays`), so the
 * cart line item and the totals can never disagree; this form owns delivery,
 * address and payment, and saves those choices back to the cart as they change.
 */
export function OrderForm({ a, trays: cartTrays, account }: { a: Availability; trays: number; account: CheckoutAccount }) {
  const router = useRouter();
  const { toast } = useToast();
  // The saved cart and address details exist only in the browser; render them after hydration to keep server and client markup identical.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const defaultPayment: Pay = a.payments.cod ? "cod" : "online";
  const [draftState] = useState(() => readDraft());
  const draft = hydrated ? draftState : null;
  const [dateState, setDate] = useState<string | null>(() => draftState?.date ?? null);
  const [slotState, setSlotId] = useState<string | null>(() => draftState?.slotId ?? null);
  const [paymentState, setPayment] = useState<Pay>(() => (draftState?.payment === "online" ? "online" : draftState?.payment === "cod" ? "cod" : defaultPayment));
  // Delivery address: one of the customer's saved addresses, the default one to start with.
  const defaultAddressId = account.addresses.find((x) => x.isDefault)?.id ?? account.addresses[0]?.id ?? null;
  const [addressChoice, setAddressId] = useState<string | null>(null);
  const addressId = addressChoice && account.addresses.some((x) => x.id === addressChoice) ? addressChoice : defaultAddressId;
  const [notesState, setNotes] = useState(() => draftState?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  /** Online payment in progress: "verifying" covers the moment between paying and the order being placed. */
  const [payStage, setPayStage] = useState<"idle" | "starting" | "paying" | "verifying">("idle");
  /** Shown when an online payment didn't complete, so no order was placed. */
  const [payFail, setPayFail] = useState<{ title: string; message: string; refunded?: boolean } | null>(null);
  const [locating, setLocating] = useState(false);
  /** Set when the customer seems to be somewhere else than the delivery pin; asks them to confirm. */
  const [farAway, setFarAway] = useState<{ distance: number; label: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Before hydration, show the server defaults so the first paint matches; the draft takes over right after.
  const dateWanted = hydrated ? dateState : null;
  const slotWanted = hydrated ? slotState : null;
  // Fall back if the saved choice isn't offered any more (for example online payment switched off).
  const wanted = hydrated ? paymentState : defaultPayment;
  const payment: Pay = a.payments[wanted] ? wanted : a.payments.cod ? "cod" : "online";
  const notes = hydrated ? notesState : "";

  // Keep the live snapshot fresh: stock and windows change as other people order.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  const trays = Math.max(1, Math.min(cartTrays, a.maxTrays));
  const { day, slot } = resolveChoice(a, dateWanted, slotWanted);
  const date = day?.date ?? null;
  const slotId = slot?.id ?? null;

  /** Save the in-progress order to the cart after any change the customer makes. */
  function persist(patch: Partial<{ trays: number; date: string | null; slotId: string | null; payment: Pay; notes: string }>) {
    writeDraft({ trays, date, slotId, payment, notes, ...patch });
  }
  void draft;
  const overStock = cartTrays > a.maxTrays;
  const fee = deliveryFeeFor(trays, a.deliveryFee, a.freeDeliveryFrom);
  const subtotal = trays * a.price;
  const total = subtotal + fee;
  const canSubmit = a.status.open && !!date && !!slot?.ok && a.available > 0 && !!addressId && !submitting && !locating;

  function showAddressError(message: string) {
    setErrors({ addressId: message });
    document.getElementById("delivery-address")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !slotId) return;
    const address = account.addresses.find((x) => x.id === addressId);
    if (!address) return showAddressError("Add a delivery address first.");
    if (address.lat === null || address.lng === null) return showAddressError("Drop a pin on the map for this address so the rider can find you. Tap Add map pin.");

    // Compare where the customer is now with the delivery pin. If they're
    // clearly somewhere else, ask before ordering. If location isn't
    // available (blocked, no GPS), go ahead: the pin is what the rider uses.
    setLocating(true);
    const here = await getCurrentPosition({ timeout: 8_000, maximumAge: 120_000 });
    setLocating(false);
    if (here.ok) {
      const distance = distanceMeters(here.pos, { lat: address.lat, lng: address.lng });
      const slack = 300 + Math.min(here.pos.accuracy, 1500);
      if (distance > slack) {
        setFarAway({ distance, label: address.label });
        return;
      }
    }
    await place();
  }

  async function place() {
    if (!date || !slotId || !addressId) return;
    setFarAway(null);
    setPayFail(null);
    setSubmitting(true);
    setErrors({});
    if (payment === "online") return payOnline();
    const res = await placeOrderAction({ trays, date, slotId, payment, addressId, notes });
    if (res.ok) {
      clearDraft();
      router.push(`/order/${res.data.id}?new=1`);
      return;
    }
    setSubmitting(false);
    showErrors(res.errors);
  }

  /**
   * Online: the server prices the order and opens a Razorpay order; the
   * customer pays in Razorpay Checkout; the server verifies the payment and
   * only then places the order. Any failure means no order.
   */
  async function payOnline() {
    if (!date || !slotId || !addressId) return;
    setPayStage("starting");
    const start = await startPaymentAction({ trays, date, slotId, payment: "online", addressId, notes });
    if (!start.ok) {
      setPayStage("idle");
      setSubmitting(false);
      showErrors(start.errors);
      return;
    }
    setPayStage("paying");
    const outcome = await payWithRazorpay({
      keyId: start.data.keyId,
      razorpayOrderId: start.data.razorpayOrderId,
      amount: start.data.amount,
      prefill: start.data.prefill,
      description: `${trays} egg tray${trays > 1 ? "s" : ""} · ${trays * 30} eggs`,
    }).catch((): { status: "failed"; reason: string } => ({ status: "failed", reason: "The payment page didn't load. Check your connection and try again." }));

    if (outcome.status !== "paid") {
      void paymentFailedAction(start.data.razorpayOrderId, outcome.reason);
      setPayStage("idle");
      setSubmitting(false);
      setPayFail({ title: "Order failed: payment didn't go through", message: `${outcome.reason} You haven't been charged, and no order was placed.` });
      return;
    }

    setPayStage("verifying");
    const res = await confirmPaymentAction({
      razorpayOrderId: outcome.razorpayOrderId,
      razorpayPaymentId: outcome.razorpayPaymentId,
      razorpaySignature: outcome.razorpaySignature,
    }).catch(() => null);
    if (res?.ok) {
      clearDraft();
      router.push(`/order/${res.data.id}?new=1&paid=1`);
      return;
    }
    setPayStage("idle");
    setSubmitting(false);
    if (res?.errors.auth) {
      toast(res.errors.auth, "error");
      router.push("/login?next=/cart");
      return;
    }
    setPayFail({
      title: res?.refunded ? "Order failed: payment refunded" : "Order failed",
      message: res?.errors.form ?? "We couldn't confirm your payment. If money was taken, the order will appear in My orders within a few minutes, or it will be refunded.",
      refunded: res?.refunded,
    });
    router.refresh();
  }

  function showErrors(errs: Record<string, string>) {
    const res = { errors: errs };
    if (res.errors.auth) {
      toast(res.errors.auth, "error");
      router.push("/login?next=/cart");
      return;
    }
    setErrors(res.errors);
    if (res.errors.payment) toast(res.errors.payment, "error");
    const first = Object.keys(res.errors)[0];
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
    if (el) el.focus();
    else toast(res.errors.form ?? res.errors[first] ?? "Please check the form.", "error");
    if (res.errors.slot || res.errors.trays) router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-4 pb-28 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:pb-0">
      <div className="card grid gap-6">
        {/* cart line item */}
        <section className="grid gap-3" aria-label="Items in your cart">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold">Items</h2>
            <span className="text-xs text-ink-3">
              {trays} tray{trays === 1 ? "" : "s"} · {trays * 30} eggs
            </span>
          </div>
          <CartLine a={a} trays={trays} fee={fee} />
          {overStock && <Note tone="warn">Only {a.maxTrays} tray{a.maxTrays === 1 ? "" : "s"} can be ordered right now, so your cart was set to {a.maxTrays}.</Note>}
          {errors.trays && <p className="text-xs text-bad">{errors.trays}</p>}
        </section>

        {/* delivery */}
        <section className="grid gap-4 border-t border-line pt-6">
          <h2 className="font-display text-xl font-bold">Delivery</h2>
          <div className="grid gap-2">
            <span className="eyebrow">Day</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {a.days.map((d) => (
                <Choice
                  key={d.date}
                  name="date"
                  value={d.date}
                  checked={d.date === date}
                  disabled={!d.open}
                  onChange={(v) => {
                    setDate(v);
                    setSlotId(null);
                    persist({ date: v, slotId: a.days.find((x) => x.date === v)?.slots.find((s) => s.ok)?.id ?? null });
                  }}
                  title={d.label}
                  sub={d.long + (d.open ? "" : " · full")}
                />
              ))}
            </div>
          </div>
          {errors.slot && <p className="text-xs text-bad">{errors.slot}</p>}
          <p className="text-xs text-ink-3">Delivered to your door by {fmtTime(a.deadline)} on the day you pick.</p>
        </section>

        {/* address */}
        <section id="delivery-address" className="grid scroll-mt-24 gap-4 border-t border-line pt-6">
          <h2 className="font-display text-xl font-bold">Deliver to</h2>
          <AddressBook addresses={account.addresses} pincodes={a.pincodes} defaults={account.defaults} selectable={{ selectedId: addressId, onSelect: (id) => { setAddressId(id); setErrors((e) => ({ ...e, addressId: "" })); }, error: errors.addressId }} />
          <Field label="Note for the rider" htmlFor="notes" optional>
            <input
              id="notes"
              name="notes"
              className="input"
              placeholder="Gate code, call before arriving…"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                persist({ notes: e.target.value });
              }}
            />
          </Field>
        </section>

        {/* payment */}
        <section className="grid gap-4 border-t border-line pt-6">
          <h2 className="font-display text-xl font-bold">Payment</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {a.payments.cod && (
              <Choice
                name="payment"
                value="cod"
                checked={payment === "cod"}
                onChange={() => {
                  setPayment("cod");
                  persist({ payment: "cod" });
                }}
                title="Cash on delivery"
                sub="Pay the rider"
              />
            )}
            {a.payments.online && (
              <Choice
                name="payment"
                value="online"
                checked={payment === "online"}
                onChange={() => {
                  setPayment("online");
                  persist({ payment: "online" });
                }}
                title="Pay online"
                sub="UPI, cards, netbanking · secured by Razorpay"
              />
            )}
          </div>
          {errors.payment && <p className="text-xs text-bad">{errors.payment}</p>}
        </section>
      </div>

      {/* summary (laptop) */}
      <aside className="card hidden content-start gap-4 self-start lg:sticky lg:top-20 lg:grid">
        <h2 className="font-display text-xl font-bold">Summary</h2>
        <SummaryLines trays={trays} price={a.price} subtotal={subtotal} fee={fee} total={total} a={a} />
        <p className="text-sm text-ink-2">{day && slot ? `Delivery ${day.label.toLowerCase() === "today" ? "today" : day.long}, by ${fmtTime(a.deadline)}` : "No delivery day available"}</p>
        {errors.form && <Note tone="bad">{errors.form}</Note>}
        {a.status.board ? (
          <ClosedButton board={a.status.board} detail={a.status.detail} size="lg" />
        ) : (
          <Button type="submit" variant="sage" size="lg" disabled={!canSubmit} loading={submitting || locating} className="w-full">
            {locating ? "Checking your location…" : payStage === "starting" ? "Opening payment…" : payStage === "paying" ? "Waiting for payment…" : payment === "online" ? `Pay ${inr(total)} & place order` : `Place order · ${inr(total)}`}
          </Button>
        )}
        <p className="text-xs text-ink-3">Your price is locked when you order. Cancel free of charge until we pack it.</p>
      </aside>

      {/* summary (phone) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {errors.form && <p className="mb-2 text-xs text-bad">{errors.form}</p>}
        <div className="container-x flex items-center justify-between gap-3 px-0">
          <div>
            <div className="num text-lg font-bold">{inr(total)}</div>
            <div className="text-xs text-ink-3">
              {trays} tray{trays > 1 ? "s" : ""} · {day ? (day.label.toLowerCase() === "today" ? "today" : day.label) : "no day"}
              {fee === 0 && a.deliveryFee > 0 ? " · free delivery" : ""}
            </div>
          </div>
          {a.status.board ? (
            <ClosedButton board={a.status.board} detail={a.status.detail} size="md" className="w-44 shrink-0 min-w-0" />
          ) : (
            <Button type="submit" variant="sage" size="lg" disabled={!canSubmit} loading={submitting || locating}>
              {locating ? "Checking…" : payStage !== "idle" ? "Paying…" : payment === "online" ? `Pay ${inr(total)}` : "Place order"}
            </Button>
          )}
        </div>
      </div>

      {payStage === "verifying" && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-paper/90 p-6 text-center backdrop-blur-sm" role="status" aria-live="assertive">
          <div className="grid justify-items-center gap-3">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-mint-100 border-t-forest-900" aria-hidden="true" />
            <p className="font-display text-xl font-bold">Payment received</p>
            <p className="max-w-xs text-sm text-ink-2">Confirming it and placing your order. Please don&apos;t close this page.</p>
          </div>
        </div>
      )}

      {payFail && (
        <PaymentFailedDialog
          title={payFail.title}
          message={payFail.message}
          canPayCash={a.payments.cod && !payFail.refunded}
          onRetry={() => {
            setPayFail(null);
            void place();
          }}
          onCash={() => {
            setPayFail(null);
            setPayment("cod");
            persist({ payment: "cod" });
          }}
          onClose={() => setPayFail(null)}
        />
      )}

      {farAway && (
        <FarAwayDialog
          distance={farAway.distance}
          label={farAway.label}
          onConfirm={() => void place()}
          onChange={() => {
            setFarAway(null);
            document.getElementById("delivery-address")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}
    </form>
  );
}

/** Online payment didn't complete, so the order wasn't placed. */
function PaymentFailedDialog({
  title,
  message,
  canPayCash,
  onRetry,
  onCash,
  onClose,
}: {
  title: string;
  message: string;
  canPayCash: boolean;
  onRetry: () => void;
  onCash: () => void;
  onClose: () => void;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    retryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-3 sm:place-items-center" onClick={onClose}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="payfail-title" aria-describedby="payfail-text" className="w-full max-w-md rounded-2xl bg-paper p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-bad/10 text-bad" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.5v.01" />
          </svg>
        </div>
        <h2 id="payfail-title" className="font-display text-xl font-bold">
          {title}
        </h2>
        <p id="payfail-text" className="mt-2 text-sm text-ink-2">
          {message}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {canPayCash ? (
            <Button type="button" variant="outline" onClick={onCash}>
              Pay cash on delivery
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
          <Button ref={retryRef} type="button" variant="sage" onClick={onRetry}>
            Try paying again
          </Button>
        </div>
      </div>
    </div>
  );
}

/** "Are you sure?" when the delivery pin is far from where the customer is right now. */
function FarAwayDialog({ distance, label, onConfirm, onChange }: { distance: number; label: string; onConfirm: () => void; onChange: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onChange();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChange]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-3 sm:place-items-center" onClick={onChange}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="far-title"
        aria-describedby="far-text"
        className="w-full max-w-md rounded-2xl bg-paper p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-warn-soft text-warn">
          <IconPin width={22} height={22} />
        </div>
        <h2 id="far-title" className="font-display text-xl font-bold">
          Deliver to this address?
        </h2>
        <p id="far-text" className="mt-2 text-sm text-ink-2">
          You seem to be about <b>{formatDistance(distance)}</b> away from your <b>{label}</b> pin. This isn&apos;t your current location. Are you sure you want the order delivered there?
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={onChange}>
            Change address
          </Button>
          <Button ref={confirmRef} type="button" variant="sage" onClick={onConfirm}>
            Yes, deliver there
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryLines({ trays, price, subtotal, fee, total, a }: { trays: number; price: number; subtotal: number; fee: number; total: number; a: Availability }) {
  return (
    <div className="grid gap-1 text-sm">
      <div className="flex justify-between py-1">
        <span>
          {trays} × tray @ {inr(price)}
        </span>
        <span className="num">{inr(subtotal)}</span>
      </div>
      <div className="flex justify-between py-1">
        <span>Delivery{fee === 0 && a.deliveryFee > 0 ? " (free)" : ""}</span>
        <span className="num">{inr(fee)}</span>
      </div>
      {fee > 0 && a.freeDeliveryFrom > 0 && (
        <p className="text-xs text-ink-3">
          Add {a.freeDeliveryFrom - trays} more tray{a.freeDeliveryFrom - trays === 1 ? "" : "s"} for free delivery.
        </p>
      )}
      <div className="mt-2 flex justify-between border-t border-line pt-3 text-base font-bold">
        <span>Total</span>
        <span className="num">{inr(total)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-ink-3">
        <span>
          {a.available} tray{a.available === 1 ? "" : "s"} left · cutoff {fmtTime(a.cutoff)}
        </span>
      </div>
    </div>
  );
}

/** The egg tray as a cart line: picture, name, unit price, quantity, line total and remove. */
export function CartLine({ a, trays, fee }: { a: Availability; trays: number; fee: number }) {
  const { toast } = useToast();
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-mint-50 p-3 sm:gap-4">
      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-mint-100 sm:h-24 sm:w-24">
        <EggTray className="w-16 sm:w-20" />
      </div>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Farm-fresh egg tray</p>
            <p className="text-xs text-ink-3">
              30 eggs per tray · {inr(a.price)} per tray
            </p>
          </div>
          <p className="num shrink-0 font-bold">{inr(trays * a.price)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Stepper value={trays} min={1} max={a.maxTrays} onChange={(n) => setCartTrays(n)} label="Number of trays" />
          <button
            type="button"
            onClick={() => {
              clearDraft();
              toast("Removed from cart");
            }}
            className="text-xs font-semibold text-ink-3 underline-offset-2 hover:text-bad hover:underline"
          >
            Remove
          </button>
        </div>
        <p className="text-xs text-ink-3">
          {trays * 30} eggs · minimum 1 tray, maximum {a.maxTrays}
          {a.deliveryFee === 0 ? " · free home delivery" : fee === 0 ? " · free delivery unlocked" : a.freeDeliveryFrom > 0 ? ` · free delivery from ${a.freeDeliveryFrom} trays` : ""}
        </p>
      </div>
    </div>
  );
}
