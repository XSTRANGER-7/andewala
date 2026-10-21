"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconCheck } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import type { Profile } from "@/server/accounts";
import { saveProfileAction } from "@/server/actions/account";

/** Name and contacts. A contact used to log in is verified and shown read-only; the other one can be added or changed. */
export function ProfileCard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const res = await saveProfileAction({
      name,
      ...(profile.phoneVerified ? {} : { phone }),
      ...(profile.emailVerified ? {} : { email }),
    });
    setBusy(false);
    if (!res.ok) return setErrors(res.errors);
    setEditing(false);
    toast("Profile saved");
    router.refresh();
  }


  if (!editing) {
    return (
      <div className="grid gap-3">
        <dl className="grid gap-2 text-sm">
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-ink-3">Name</dt>
            <dd className="font-medium">{profile.name || "—"}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <dt className="w-16 shrink-0 text-ink-3">Mobile</dt>
            <dd className="num font-medium">{profile.phone ?? "—"}</dd>
            {profile.phoneVerified && <Verified />}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <dt className="w-16 shrink-0 text-ink-3">Email</dt>
            <dd className="min-w-0 truncate font-medium">{profile.email ?? "—"}</dd>
            {profile.emailVerified && <Verified />}
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="grid gap-3" noValidate>
      <Field label="Name" htmlFor="pf-name" error={errors.name}>
        <input id="pf-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Mobile number" htmlFor="pf-phone" error={errors.phone} hint={profile.phoneVerified ? "Verified when you logged in." : "The rider calls this number."}>
        <input id="pf-phone" className="input num" type="tel" inputMode="numeric" disabled={profile.phoneVerified} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Email" htmlFor="pf-email" error={errors.email} hint={profile.emailVerified ? "Verified when you logged in." : "Not verified yet. Log in with it once to verify."}>
        <input id="pf-email" className="input" type="email" disabled={profile.emailVerified} value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {errors.form && <p className="text-sm text-bad">{errors.form}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={busy}>
          Save
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Verified() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">
      <IconCheck width={11} height={11} /> Verified
    </span>
  );
}
