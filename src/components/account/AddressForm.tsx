"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { cn } from "@/lib/cn";
import type { AddressView } from "@/server/accounts";
import { saveAddressAction } from "@/server/actions/account";

const LABELS = ["Home", "Work", "Other"];

type Props = {
  /** Existing address to edit; omit to add a new one. */
  initial?: AddressView;
  /** Pre-fill for a new address (the customer's own name and mobile). */
  defaults?: { name: string; phone: string };
  pincodes: string[];
  onSaved: (a: AddressView) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function AddressForm({ initial, defaults, pincodes, onSaved, onCancel, submitLabel }: Props) {
  const [f, setF] = useState({
    label: initial?.label ?? "Home",
    name: initial?.name ?? defaults?.name ?? "",
    phone: initial?.phone ?? defaults?.phone ?? "",
    address: initial?.address ?? "",
    landmark: initial?.landmark ?? "",
    pincode: initial?.pincode ?? "",
  });
  const [makeDefault, setMakeDefault] = useState(!initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  async function submit() {
    const pin = f.pincode.trim();
    if (pincodes.length && /^\d{6}$/.test(pin) && !pincodes.includes(pin)) {
      setErrors({ pincode: `We don't deliver to ${pin} yet. We deliver to ${pincodes.join(", ")}.` });
      return;
    }
    setBusy(true);
    const res = await saveAddressAction(f, { id: initial?.id, makeDefault });
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
      <Field label="House, street and area" htmlFor="ad-address" error={errors.address}>
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
