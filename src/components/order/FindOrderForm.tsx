"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { findOrderAction } from "@/server/actions/order";

export function FindOrderForm({ initialId = "" }: { initialId?: string }) {
  const router = useRouter();
  const [id, setId] = useState(initialId);
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const res = await findOrderAction({ id, phone });
    setBusy(false);
    if (res.ok) router.push(res.data.url);
    else setErrors(res.errors);
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Order ID" htmlFor="find-id" error={errors.id}>
          <input id="find-id" className="input num uppercase" placeholder="EGG-1021-7K3M" value={id} onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="Mobile number used" htmlFor="find-phone" error={errors.phone}>
          <input id="find-phone" className="input num" type="tel" inputMode="numeric" placeholder="10-digit number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      {errors.form && <p className="text-sm text-bad">{errors.form}</p>}
      <div>
        <Button type="submit" variant="primary" loading={busy}>
          Find my order
        </Button>
      </div>
    </form>
  );
}
