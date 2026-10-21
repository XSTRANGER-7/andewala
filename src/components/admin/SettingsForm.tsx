"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { useToast } from "@/components/ui/Toast";
import type { DeliverySlot, StoreSettings } from "@/lib/types";
import { saveSettingsAction } from "@/server/actions/admin";

type Props = { settings: Omit<StoreSettings, "priceUpdatedAt"> };

export function SettingsForm({ settings }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [storeName, setStoreName] = useState(settings.storeName);
  const [areaName, setAreaName] = useState(settings.areaName);
  const [supportPhone, setSupportPhone] = useState(settings.supportPhone);
  const [pincodes, setPincodes] = useState(settings.pincodes.join(", "));
  const [cutoff, setCutoff] = useState(settings.cutoff);
  const [deadline, setDeadline] = useState(settings.deadline);
  const [daysAhead, setDaysAhead] = useState(String(settings.daysAhead));
  const [slots, setSlots] = useState<DeliverySlot[]>(settings.slots);
  const [deliveryFee, setDeliveryFee] = useState(String(settings.deliveryFee));
  const [freeFrom, setFreeFrom] = useState(String(settings.freeDeliveryFrom));
  const [maxTrays, setMaxTrays] = useState(String(settings.maxTrays));
  const [target, setTarget] = useState(String(settings.targetContribution));
  const [cod, setCod] = useState(settings.codEnabled);
  const [upi, setUpi] = useState(settings.upiOnDelivery);

  function updateSlot(i: number, patch: Partial<DeliverySlot>) {
    setSlots((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const pins = pincodes.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    start(async () => {
      const res = await saveSettingsAction({
        storeName,
        areaName,
        supportPhone,
        pincodes: pins,
        cutoff,
        deadline,
        daysAhead: Number(daysAhead),
        slots: slots.map((s) => ({ ...s, label: s.label.trim() || "Window", capacity: Number(s.capacity) || 0 })),
        deliveryFee: Number(deliveryFee),
        freeDeliveryFrom: Number(freeFrom),
        maxTrays: Number(maxTrays),
        targetContribution: Number(target),
        codEnabled: cod,
        upiOnDelivery: upi,
      });
      if (res.ok) {
        toast(res.message);
        router.refresh();
      } else {
        setErrors(res.errors);
        toast("Check the form.", "error");
      }
    });
  }

  const pinError = Object.entries(errors).find(([k]) => k.startsWith("pincodes"))?.[1];
  const slotError = errors.slots ?? Object.entries(errors).find(([k]) => k.startsWith("slots"))?.[1];

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <section className="card grid gap-4">
        <h2 className="font-display text-lg font-bold">Store</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name" htmlFor="g-name" error={errors.storeName}>
            <input id="g-name" className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </Field>
          <Field label="Delivery area name" htmlFor="g-area" error={errors.areaName} hint="Shown when no PIN codes are set.">
            <input id="g-area" className="input" value={areaName} onChange={(e) => setAreaName(e.target.value)} />
          </Field>
          <Field label="Support phone" htmlFor="g-phone" optional>
            <input id="g-phone" className="input num" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
          </Field>
          <Field label="PIN codes you deliver to" htmlFor="g-pins" error={pinError} hint="Comma separated. Leave empty to accept any PIN code.">
            <input id="g-pins" className="input num" placeholder="110001, 110002" value={pincodes} onChange={(e) => setPincodes(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card grid gap-4">
        <h2 className="font-display text-lg font-bold">Same-day rules</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Same-day order cutoff" htmlFor="g-cut" hint="5:00 PM is a safe start." error={errors.cutoff}>
            <input id="g-cut" type="time" className="input" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
          </Field>
          <Field label="Last delivery by" htmlFor="g-dead" error={errors.deadline}>
            <input id="g-dead" type="time" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Field label="Days customers can book ahead" htmlFor="g-ahead" error={errors.daysAhead}>
            <input id="g-ahead" type="number" min={1} max={7} className="input num" value={daysAhead} onChange={(e) => setDaysAhead(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Delivery windows</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => setSlots((s) => [...s, { id: "s" + Math.random().toString(36).slice(2, 7), label: "7–8 PM", start: "19:00", end: "20:00", capacity: 4 }])}>
            Add window
          </Button>
        </div>
        <div className="grid gap-3">
          {slots.map((s, i) => (
            <div key={s.id} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1.3fr_1fr_1fr_.8fr_auto] sm:border-0 sm:p-0">
              <Field label="Label" htmlFor={`sl-l${i}`} className="col-span-2 sm:col-span-1">
                <input id={`sl-l${i}`} className="input" value={s.label} onChange={(e) => updateSlot(i, { label: e.target.value })} />
              </Field>
              <Field label="Starts" htmlFor={`sl-s${i}`}>
                <input id={`sl-s${i}`} type="time" className="input" value={s.start} onChange={(e) => updateSlot(i, { start: e.target.value })} />
              </Field>
              <Field label="Ends" htmlFor={`sl-e${i}`}>
                <input id={`sl-e${i}`} type="time" className="input" value={s.end} onChange={(e) => updateSlot(i, { end: e.target.value })} />
              </Field>
              <Field label="Max orders" htmlFor={`sl-c${i}`}>
                <input id={`sl-c${i}`} type="number" min={0} className="input num" value={s.capacity} onChange={(e) => updateSlot(i, { capacity: Number(e.target.value) })} />
              </Field>
              <Button type="button" size="sm" variant="danger" onClick={() => setSlots((list) => list.filter((_, k) => k !== i))} aria-label={`Remove ${s.label}`}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        {slotError && <Note tone="bad">{slotError}</Note>}
        <p className="text-xs text-ink-3">Max orders is how many stops you can actually finish in that window.</p>
      </section>

      <section className="card grid gap-4">
        <h2 className="font-display text-lg font-bold">Fees and payment</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Delivery fee (₹)" htmlFor="g-fee" error={errors.deliveryFee}>
            <input id="g-fee" type="number" min={0} className="input num" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          </Field>
          <Field label="Free delivery from (trays)" htmlFor="g-free" hint="0 means never free." error={errors.freeDeliveryFrom}>
            <input id="g-free" type="number" min={0} className="input num" value={freeFrom} onChange={(e) => setFreeFrom(e.target.value)} />
          </Field>
          <Field label="Max trays per order" htmlFor="g-max" error={errors.maxTrays}>
            <input id="g-max" type="number" min={1} className="input num" value={maxTrays} onChange={(e) => setMaxTrays(e.target.value)} />
          </Field>
          <Field label="Target margin per tray (₹)" htmlFor="g-target" error={errors.targetContribution}>
            <input id="g-target" type="number" min={0} className="input num" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} className="h-4 w-4 accent-forest-900" /> Accept cash on delivery
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={upi} onChange={(e) => setUpi(e.target.checked)} className="h-4 w-4 accent-forest-900" /> Accept UPI on delivery
        </label>
        {errors.codEnabled && <p className="text-sm text-bad">{errors.codEnabled}</p>}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="lg" loading={pending}>
          Save settings
        </Button>
        {errors.form && <span className="text-sm text-bad">{errors.form}</span>}
      </div>
    </form>
  );
}
