"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconCheck } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import type { Profile } from "@/server/accounts";
import { saveProfileAction, setPasswordAction } from "@/server/actions/account";
import { EmailVerify } from "./EmailVerify";

/** Name, mobile number (no code needed) and email (verified with a code; read-only once verified). */
export function ProfileCard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const res = await saveProfileAction({
      name,
      phone: phone.replace(/\D/g, "").slice(-10),
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
        {!profile.emailVerified && profile.email && (
          <div className="grid gap-2 rounded-xl border border-line p-3">
            <p className="text-sm font-semibold">Verify your email to order</p>
            <EmailVerify email={profile.email} verified={false} onVerified={() => { toast("Email verified"); router.refresh(); }} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        </div>
        <PasswordSection hasPassword={profile.hasPassword} email={profile.email} />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="grid gap-3" noValidate>
      <Field label="Name" htmlFor="pf-name" error={errors.name}>
        <input id="pf-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Mobile number" htmlFor="pf-phone" error={errors.phone} hint="The rider calls this number.">
        <input id="pf-phone" className="input num" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))} />
      </Field>
      <Field label="Email" htmlFor="pf-email" error={errors.email} hint={profile.emailVerified ? "You log in with this email." : "You'll verify it with a code."}>
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

/** Set a password (accounts made before passwords) or change it. */
function PasswordSection({ hasPassword, email }: { hasPassword: boolean; email: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setErrors({ password: "The two passwords don't match." });
    setBusy(true);
    setErrors({});
    const res = await setPasswordAction({ current, password: pw });
    setBusy(false);
    if (!res.ok) return setErrors(res.errors);
    setOpen(false);
    setCurrent("");
    setPw("");
    setPw2("");
    toast(hasPassword ? "Password changed" : "Password set");
    router.refresh();
  }

  return (
    <section className="grid gap-2 border-t border-line pt-3" aria-label="Password">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="text-ink-3">Password</span>{" "}
          <b data-has-password={hasPassword}>{hasPassword ? "Set" : "Not set"}</b>
          <span className="block text-xs text-ink-3">{hasPassword ? `Log in with ${email ?? "your email"} and this password, or with your mobile.` : "Set one to log in with your email and password."}</span>
        </p>
        {!open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {hasPassword ? "Change password" : "Set a password"}
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="grid gap-3" noValidate>
          {hasPassword && (
            <Field label="Current password" htmlFor="pw-cur" error={errors.current}>
              <input id="pw-cur" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
          )}
          <Field label="New password" htmlFor="pw-1" error={errors.password} hint="8+ characters with a letter and a number.">
            <input id="pw-1" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-2">
            <input id="pw-2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          {errors.form && <p className="text-sm text-bad">{errors.form}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!pw || !pw2 || (hasPassword && !current)}>
              Save password
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(false); setErrors({}); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
