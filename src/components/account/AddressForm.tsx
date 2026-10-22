"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { cn } from "@/lib/cn";
import type { AddressView } from "@/server/accounts";
import { saveAddressAction } from "@/server/actions/account";
import type { LatLng, PlaceGuess } from "@/lib/geo";
import { coverageAt, usesZones, type Coverage } from "@/lib/zones";

// The map library only runs in the browser.
const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="grid h-64 place-items-center rounded-xl border border-line bg-mint-100 text-sm text-ink-3 sm:h-72">Loading map…</div>,
});

const LABELS = ["Home", "Work", "Other"];

type Props = {
  /** Existing address to edit; omit to add a new one. */
  initial?: AddressView;
  /** Pre-fill for a new address (the customer's own name and mobile). */
  defaults?: { name: string; phone: string };
  coverage: Coverage;
  onSaved: (a: AddressView) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function AddressForm({ initial, defaults, coverage, onSaved, onCancel, submitLabel }: Props) {
  const pincodes = usesZones(coverage) ? [] : coverage.pincodes;
  const [f, setF] = useState({
    label: initial?.label ?? "Home",
    name: initial?.name ?? defaults?.name ?? "",
    phone: initial?.phone ?? defaults?.phone ?? "",
    address: initial?.address ?? "",
    landmark: initial?.landmark ?? "",
    pincode: initial?.pincode ?? "",
  });
  const [pin, setPin] = useState<LatLng | null>(initial && initial.lat !== null && initial.lng !== null ? { lat: initial.lat, lng: initial.lng } : null);
  // Fields the customer typed in themselves; the map only fills fields they haven't touched.
  const typed = useRef(new Set<string>(initial ? ["address", "pincode"] : []));
  const [makeDefault, setMakeDefault] = useState(!initial);
  /** The customer agreed to delivery at a pin just outside the area. */
  const [nearOk, setNearOk] = useState(false);
  const where = pin ? coverageAt(coverage, pin) : null;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => {
    typed.current.add(k);
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  function onPin(p: LatLng, guess: PlaceGuess | null) {
    setPin(p);
    setErrors((e) => (e.pin ? { ...e, pin: "" } : e));
    if (!guess) return;
    // Fill in what the pin tells us, without overwriting anything the customer typed.
    setF((x) => ({
      ...x,
      address: typed.current.has("address") ? x.address : guess.line,
      pincode: typed.current.has("pincode") || !/^\d{6}$/.test(guess.pincode) ? x.pincode : guess.pincode,
    }));
  }

  async function submit() {
    if (!pin) {
      setErrors({ pin: "Drop the pin on your door: move the map, or tap Use my current location." });
      return;
    }
    if (usesZones(coverage) && where?.status === "outside") {
      setErrors({ pin: "This pin is outside our delivery area. Move it inside the shaded area on the map." });
      return;
    }
    if (where?.status === "near" && !nearOk) {
      setErrors({ near: "Tick the box to confirm delivery to this spot just outside our area." });
      return;
    }
    const code = f.pincode.trim();
    if (pincodes.length && /^\d{6}$/.test(code) && !pincodes.includes(code)) {
      setErrors({ pincode: `We don't deliver to ${code} yet. We deliver to ${pincodes.join(", ")}.` });
      return;
    }
    setBusy(true);
    const res = await saveAddressAction({ ...f, lat: pin.lat, lng: pin.lng }, { id: initial?.id, makeDefault });
    setBusy(false);
    if (!res.ok) return setErrors(res.errors);
    onSaved(res.data);
  }

  // A <div>, not a <form>: this sits inside the checkout form, and nested forms aren't allowed.
  return (
    <div
      className="grid gap-3"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          submit();
        }
      }}
    >
      <div className="grid gap-1.5">
        <span className="text-sm font-semibold">Pin your exact location</span>
        <MapPicker value={pin} onChange={onPin} autoLocate={!pin} fallbackPincode={f.pincode.trim() || pincodes[0]} coverage={coverage} error={errors.pin} />
        {where?.status === "near" && (
          <label className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm">
            <input type="checkbox" checked={nearOk} onChange={(e) => { setNearOk(e.target.checked); setErrors((x) => ({ ...x, near: "" })); }} className="mt-0.5 h-4 w-4 accent-forest-900" />
            <span>
              <b>Yes, deliver to this spot.</b> It&apos;s {where.distanceM} m outside our area, and we&apos;ll still bring your order here.
              {errors.near && <span className="block text-xs text-bad">{errors.near}</span>}
            </span>
          </label>
        )}
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label="Address label">
        {LABELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={f.label === l}
            onClick={() => set("label", l)}
            className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition", f.label === l ? "border-forest-900 bg-mint-100 text-forest-900" : "border-line text-ink-2 hover:border-ink-3")}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="ad-name" error={errors.name}>
          <input id="ad-name" className="input" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Mobile number" htmlFor="ad-phone" error={errors.phone}>
          <input id="ad-phone" className="input num" type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit number" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>
      <Field label="House / flat number, building, street and area" htmlFor="ad-address" error={errors.address} hint="Filled in from the pin. Add your house or flat number.">
        <textarea id="ad-address" className="input min-h-20" autoComplete="street-address" value={f.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Landmark" htmlFor="ad-landmark" optional>
          <input id="ad-landmark" className="input" value={f.landmark} onChange={(e) => set("landmark", e.target.value)} />
        </Field>
        <Field label="PIN code" htmlFor="ad-pincode" error={errors.pincode} hint={pincodes.length ? `We deliver to ${pincodes.join(", ")}` : undefined}>
          <input id="ad-pincode" className="input num" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={f.pincode} onChange={(e) => set("pincode", e.target.value)} />
        </Field>
      </div>
      {!initial?.isDefault && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-4 w-4 accent-forest-900" />
          Use as my default address
        </label>
      )}
      {errors.form && <Note tone="bad">{errors.form}</Note>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" loading={busy} onClick={submit}>
          {submitLabel ?? (initial ? "Save address" : "Add address")}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
