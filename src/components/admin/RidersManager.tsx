"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { useToast } from "@/components/ui/Toast";
import { deleteRiderAction, saveRiderAction } from "@/server/actions/admin";

type Rider = { id: string; name: string; email: string; phone: string; active: boolean };
const EMPTY = { name: "", email: "", phone: "", active: true };

/** Admin: add delivery partners by the email they log in with, switch them on/off, remove them. */
export function RidersManager({ riders, out, candidates, ready }: { riders: Rider[]; out: Record<string, number>; candidates: { email: string; name: string }[]; ready: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<{ id?: string; name: string; email: string; phone: string; active: boolean }>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveRiderAction({ ...form, email: form.email.trim().toLowerCase(), phone: form.phone.replace(/\D/g, "").slice(-10) });
      if (!res.ok) return setErrors(res.errors);
      setErrors({});
      setForm(EMPTY);
      toast(res.message);
      router.refresh();
    });
  }

  function update(r: Rider, patch: Partial<Rider>) {
    start(async () => {
      const res = await saveRiderAction({ ...r, ...patch });
      toast(res.ok ? res.message : (res.errors.form ?? Object.values(res.errors)[0] ?? "That didn't save."), res.ok ? "default" : "error");
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteRiderAction(id);
      toast(res.ok ? res.message : (res.errors.form ?? "That didn't save."), res.ok ? "default" : "error");
      setConfirm(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <form onSubmit={save} className="card grid gap-3" aria-label={form.id ? "Edit rider" : "Add rider"} noValidate>
        <h2 className="font-display text-lg font-bold">{form.id ? "Edit rider" : "Add a rider"}</h2>
        <Field label="Name" htmlFor="r-name" error={errors.name}>
          <input id="r-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ramesh" />
        </Field>
        <Field label="Email" htmlFor="r-email" error={errors.email} hint="The email they log in with (or sign up with). Pick from your customers or type it.">
          <input
            id="r-email"
            className="input"
            type="email"
            list="r-email-list"
            autoComplete="off"
            value={form.email}
            onChange={(e) => {
              const email = e.target.value;
              const hit = candidates.find((c) => c.email === email.trim().toLowerCase());
              setForm({ ...form, email, ...(hit && !form.name ? { name: hit.name } : {}) });
            }}
            placeholder="rider@example.com"
          />
          <datalist id="r-email-list">
            {candidates.map((c) => (
              <option key={c.email} value={c.email}>
                {c.name}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Mobile number" htmlFor="r-phone" error={errors.phone} optional hint="Shown to customers so they can call the rider.">
          <input id="r-phone" className="input num" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-forest-900" />
          Active (can log in and deliver)
        </label>
        {errors.form && <Note tone="bad">{errors.form}</Note>}
        <div className="flex gap-2">
          <Button type="submit" variant="sage" loading={pending}>
            {form.id ? "Save rider" : "Add rider"}
          </Button>
          {form.id && (
            <Button type="button" variant="outline" onClick={() => { setForm(EMPTY); setErrors({}); }}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <section className="card grid gap-2" aria-label="Riders">
        <h2 className="font-display text-lg font-bold">Delivery partners</h2>
        {riders.length === 0 ? (
          <p className="text-sm text-ink-2">No riders yet. Add one with their email.</p>
        ) : (
          <ul className="grid gap-2">
            {riders.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.active ? "bg-good" : "bg-line"}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <b>{r.name}</b>
                  <span className="block break-all text-xs text-ink-3">
                    {r.email || "No email yet: edit to add it"}
                    {r.phone ? ` · +91 ${r.phone}` : ""}
                    {out[r.id] ? ` · ${out[r.id]} out for delivery now` : ""}
                  </span>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${ready.includes(r.email) ? "bg-good-soft text-good" : "bg-warn-soft text-ink-2"}`} data-rider-ready={ready.includes(r.email) ? "yes" : "no"}>
                    {ready.includes(r.email) ? "Account ready" : "Waiting: they need to sign up with this email"}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={r.active} disabled={pending} onChange={() => update(r, { active: !r.active })} className="h-4 w-4 accent-forest-900" />
                    {r.active ? "Active" : "Off"}
                  </label>
                  <button type="button" className="text-forest-900 hover:underline" onClick={() => { setForm(r); setErrors({}); }}>
                    Edit
                  </button>
                  {confirm === r.id ? (
                    <>
                      <button type="button" className="text-bad hover:underline" onClick={() => remove(r.id)}>
                        Yes, remove
                      </button>
                      <button type="button" className="text-ink-3 hover:underline" onClick={() => setConfirm(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" className="text-ink-3 hover:text-bad" onClick={() => setConfirm(r.id)}>
                      Remove
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
