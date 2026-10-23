"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconCheck } from "@/components/ui/Icons";
import { Note } from "@/components/ui/Note";
import { cn } from "@/lib/cn";
import { amIRiderAction, completeSignupAction, continueWithEmailAction, logoutCustomerAction, saveProfileAction, setPasswordAction } from "@/server/actions/account";
import dynamic from "next/dynamic";
import type { LatLng, PlaceGuess } from "@/lib/geo";
import { coverageAt, usesZones, type Coverage } from "@/lib/zones";
import { EmailVerify } from "./EmailVerify";

// The map library only runs in the browser.
const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="grid h-64 place-items-center rounded-xl border border-line bg-mint-100 text-sm text-ink-3">Loading map…</div>,
});

export type ResumeProfile = { name: string; email: string | null; emailVerified: boolean; hasAddress: boolean; hasPassword: boolean; phone: string | null; mode: "finish" | "verify" };

const GOOGLE_ERRORS: Record<string, string> = {
  expired: "Google sign-in took too long or was interrupted. Please try again.",
  failed: "We couldn't sign you in with Google. Please try again.",
  unverified: "Your Google account's email isn't verified. Use another sign-in option.",
};

/**
 * One login form: email + password, or Google. An email we don't know yet
 * creates the account (after confirming the password) and goes to
 * "Finish your account": name, a verified mobile, password and address.
 */
export function LoginForm({ next, coverage, resumeProfile, google, googleError }: { next: string; coverage: Coverage; resumeProfile?: ResumeProfile; google: boolean; googleError?: string }) {
  const pincodes = usesZones(coverage) ? [] : coverage.pincodes;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>(googleError && GOOGLE_ERRORS[googleError] ? { form: GOOGLE_ERRORS[googleError] } : {});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (isNew) {
      const problem = pwProblem(password);
      if (problem) return setErrors({ password: problem });
      if (password !== password2) return setErrors({ password2: "The two passwords don't match." });
    }
    setBusy(true);
    const r = await continueWithEmailAction(email, password, isNew ? password2 : undefined);
    if (!r.ok) {
      setBusy(false);
      if (r.errors.newAccount) {
        setIsNew(true);
        const rest = { ...r.errors };
        delete rest.newAccount;
        return setErrors(rest);
      }
      return setErrors(r.errors);
    }
    if (r.data.rider) {
      router.replace("/mode");
      router.refresh();
    } else if (r.data.complete) {
      router.replace(next);
      router.refresh();
    } else {
      // A full load so the server sends "Finish your account" (the session cookie is now set).
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }

  if (resumeProfile) return <ProfileStep next={next} coverage={coverage} pincodes={pincodes} resume={resumeProfile} />;

  const pwInput = (id: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-line bg-paper focus-within:border-forest-700 focus-within:ring-[3px] focus-within:ring-forest-700/20">
      <input id={id} className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[15px] outline-none" type={showPw ? "text" : "password"} autoComplete={auto} value={value} onChange={(e) => set(e.target.value)} />
      <button type="button" onClick={() => setShowPw((v) => !v)} className="px-3 text-xs font-semibold text-ink-3 hover:text-ink" aria-label={showPw ? "Hide password" : "Show password"}>
        {showPw ? "Hide" : "Show"}
      </button>
    </div>
  );

  return (
    <div className="grid gap-4">
      {google && (
        <>
          <a
            href={`/api/auth/google?next=${encodeURIComponent(next)}`}
            className="flex h-12 items-center justify-center gap-3 rounded-xl border border-line bg-paper text-sm font-semibold text-ink shadow-sm transition hover:bg-mint-50"
            data-google
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </a>
          <div className="flex items-center gap-3 text-xs text-ink-3">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Email" htmlFor="auth-email" error={errors.email}>
          <input
            id="auth-email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (isNew) { setIsNew(false); setPassword2(""); } }}
          />
        </Field>
        <Field label={isNew ? "Create a password" : "Password"} htmlFor="auth-pw" error={isNew ? errors.password : undefined} hint={isNew ? "8+ characters with a letter and a number." : undefined}>
          {pwInput("auth-pw", password, setPassword, isNew ? "new-password" : "current-password")}
        </Field>
        {isNew && (
          <>
            <Note tone="info">
              <b>New here?</b> There&apos;s no account with this email yet. Confirm your password to create one.
            </Note>
            <Field label="Confirm password" htmlFor="auth-pw2" error={errors.password2}>
              {pwInput("auth-pw2", password2, setPassword2, "new-password")}
            </Field>
          </>
        )}
        {!isNew && errors.password && (
          <p className="text-sm text-bad" role="alert">
            {errors.password}
          </p>
        )}
        {errors.form && <Note tone="bad">{errors.form}</Note>}
        <Button type="submit" variant="sage" size="lg" loading={busy} disabled={!/\S+@\S+\.\S+/.test(email) || !password || (isNew && !password2)}>
          {isNew ? "Create account" : "Log in"}
        </Button>
        {isNew && <p className="text-center text-xs text-ink-3">Next, you&apos;ll add your name, verify your mobile and add your delivery address.</p>}
      </form>
    </div>
  );
}

/**
 * New accounts, once: verified email, name, mobile number (no code), password
 * (Google sign-ups) and the first address. Existing customers only see what's
 * still missing before ordering.
 */
function ProfileStep({ next, coverage, pincodes, resume }: { next: string; coverage: Coverage; pincodes: string[]; resume: ResumeProfile }) {
  const router = useRouter();
  const verifyOnly = resume.mode === "verify";
  const needsAddress = !resume.hasAddress;
  const needsPassword = !resume.hasPassword;
  const [leaving, setLeaving] = useState(false);
  const [p, setP] = useState({ name: resume.name ?? "", email: resume.email ?? "", label: "Home", address: "", landmark: "", pincode: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [emailOk, setEmailOk] = useState(resume.emailVerified);
  const [phone, setPhone] = useState(resume.phone ?? "");
  const phoneDigits = phone.replace(/\D/g, "").slice(-10);
  const phoneOk = /^[6-9]\d{9}$/.test(phoneDigits);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [nearOk, setNearOk] = useState(false);
  const typed = useRef(new Set<string>());
  const where = pin ? coverageAt(coverage, pin) : null;

  function onPin(nextPin: LatLng, guess: PlaceGuess | null) {
    setPin(nextPin);
    setErrors((e) => (e.pin ? { ...e, pin: "" } : e));
    if (!guess) return;
    setP((x) => ({
      ...x,
      address: typed.current.has("address") ? x.address : guess.line,
      pincode: typed.current.has("pincode") || !/^\d{6}$/.test(guess.pincode) ? x.pincode : guess.pincode,
    }));
  }
  const set = (k: keyof typeof p, v: string) => {
    typed.current.add(k);
    setP((x) => ({ ...x, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOk) return setErrors({ emailCode: "Verify your email to continue." });
    if (!phoneOk) return setErrors({ phone: "Enter a 10-digit mobile number." });
    if (needsAddress) {
      if (!pin) return setErrors({ pin: "Drop the pin on your door: move the map, or tap Use my current location." });
      if (where?.status === "outside") return setErrors({ pin: "This pin is outside our delivery area. Move it inside the shaded area on the map." });
      if (where?.status === "near" && !nearOk) return setErrors({ near: "Tick the box to confirm delivery to this spot just outside our area." });
      if (pincodes.length && /^\d{6}$/.test(p.pincode.trim()) && !pincodes.includes(p.pincode.trim())) {
        return setErrors({ pincode: `We don't deliver to ${p.pincode.trim()} yet. We deliver to ${pincodes.join(", ")}.` });
      }
    }
    if (needsPassword) {
      const problem = pwProblem(pw) ?? (pw !== pw2 ? "The two passwords don't match." : null);
      if (problem) return setErrors({ password: problem });
    }
    setBusy(true);
    setErrors({});
    const res =
      needsAddress && pin
        ? await completeSignupAction({ ...p, phone: phoneDigits, lat: pin.lat, lng: pin.lng, ...(needsPassword ? { password: pw } : {}) })
        : await saveProfileAction({ name: p.name, phone: phoneDigits });
    if (!res.ok) {
      setBusy(false);
      return setErrors(res.errors);
    }
    if (needsPassword && !needsAddress) {
      const r2 = await setPasswordAction({ password: pw });
      if (!r2.ok) {
        setBusy(false);
        return setErrors({ password: r2.errors.password ?? r2.errors.form ?? "That password didn't save." });
      }
    }
    // Delivery partners choose Rider mode or shopping next.
    router.replace((await amIRiderAction()) ? "/mode" : next);
    router.refresh();
  }

  /** New account: going back logs out (nothing half-made stays logged in). Existing customer: back to the shop. */
  async function leave() {
    setLeaving(true);
    if (!verifyOnly) await logoutCustomerAction();
    window.location.replace("/");
  }
  const showName = !verifyOnly || resume.name.trim().length < 2;
  const showPhone = !verifyOnly || !resume.phone;
  const showEmailCheck = !resume.emailVerified;

  const done = {
    email: emailOk,
    name: p.name.trim().length >= 2,
    phone: phoneOk,
    password: !pwProblem(pw) && pw === pw2,
    address: !!pin && where?.status !== "outside" && (where?.status !== "near" || nearOk) && p.address.trim().length >= 8 && /^\d{6}$/.test(p.pincode.trim()),
  };
  const steps = [
    ...(showEmailCheck ? [done.email] : []),
    ...(showName ? [done.name] : []),
    ...(showPhone ? [done.phone] : []),
    ...(needsPassword ? [done.password] : []),
    ...(needsAddress ? [done.address] : []),
  ];
  const doneCount = steps.filter(Boolean).length;
  let n = 0;

  const ready =
    emailOk &&
    phoneOk &&
    p.name.trim().length >= 2 &&
    (!needsAddress || (!!pin && p.address.trim().length >= 8 && /^\d{6}$/.test(p.pincode.trim()))) &&
    (!needsPassword || (pw.length > 0 && pw2.length > 0));

  return (
    <form onSubmit={finish} className="flex min-w-0 flex-col gap-4" noValidate>
      <div className="flex min-w-0 flex-col gap-3">
        <button
          type="button"
          onClick={leave}
          disabled={leaving}
          className="-ml-2 inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-2 transition hover:bg-mint-50 hover:text-ink disabled:opacity-60"
          data-leave
        >
          <span aria-hidden="true">←</span> {verifyOnly ? "Back to shop" : leaving ? "Logging out…" : "Back (log out)"}
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{verifyOnly ? "One more step to order" : "Finish your account"}</h1>
          {!showEmailCheck && resume.email && <p className="mt-1 break-all text-sm text-ink-3">{resume.email}</p>}
        </div>
        {steps.length > 1 && (
          <div className="flex items-center gap-3" aria-label={`${doneCount} of ${steps.length} done`}>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mint-100">
              <div className="h-full rounded-full bg-forest-700 transition-all duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <span className="num shrink-0 text-xs font-semibold text-ink-3">
              {doneCount}/{steps.length}
            </span>
          </div>
        )}
      </div>

      {showEmailCheck && resume.email && (
        <Section n={++n} title="Verify your email" done={done.email}>
          <EmailVerify stay email={resume.email} verified={emailOk} onVerified={() => { setEmailOk(true); setErrors((x) => ({ ...x, emailCode: "" })); }} error={errors.emailCode} />
        </Section>
      )}

      {showName && (
        <Section n={++n} title="Your name" done={done.name}>
          <input id="pname" className="input text-base sm:text-[15px]" autoComplete="name" placeholder="Full name" aria-label="Full name" value={p.name} onChange={(e) => set("name", e.target.value)} />
          {errors.name && <p className="text-xs text-bad" role="alert">{errors.name}</p>}
        </Section>
      )}

      {showPhone && (
        <Section n={++n} title="Mobile number" done={done.phone} note="The rider calls this">
          <div className="flex min-w-0 items-stretch overflow-hidden rounded-lg border border-line bg-paper focus-within:border-forest-700 focus-within:ring-[3px] focus-within:ring-forest-700/20">
            <span className="num grid place-items-center border-r border-line bg-mint-50 px-3 text-[15px] font-semibold text-ink-2">+91</span>
            <input
              id="pphone"
              className="num min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base tracking-wide outline-none sm:text-[15px]"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              maxLength={11}
              aria-label="Mobile number"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/[^\d ]/g, "")); setErrors((x) => ({ ...x, phone: "" })); }}
            />
          </div>
          {errors.phone && <p className="text-xs text-bad" role="alert">{errors.phone}</p>}
        </Section>
      )}

      {needsPassword && (
        <Section n={++n} title="Password" done={done.password} note="8+ characters, letters and a number">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <input id="pw-new" className="input text-base sm:text-[15px]" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="Password" aria-label="Password" value={pw} onChange={(e) => { setPw(e.target.value); setErrors((x) => ({ ...x, password: "" })); }} />
            <input id="pw-new2" className="input text-base sm:text-[15px]" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="Confirm password" aria-label="Confirm password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErrors((x) => ({ ...x, password: "" })); }} />
          </div>
          <label className="flex w-fit items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="h-4 w-4 accent-forest-900" />
            Show password
          </label>
          {errors.password && <p className="text-xs text-bad" role="alert">{errors.password}</p>}
        </Section>
      )}

      {needsAddress && (
        <Section
          n={++n}
          title="Delivery address"
          done={done.address}
          action={
            <div className="flex gap-1" role="radiogroup" aria-label="Address label">
              {["Home", "Work", "Other"].map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={p.label === l}
                  onClick={() => set("label", l)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold transition", p.label === l ? "border-forest-900 bg-mint-100 text-forest-900" : "border-line text-ink-2 hover:border-ink-3")}
                >
                  {l}
                </button>
              ))}
            </div>
          }
        >
          <p className="text-xs text-ink-3">Move the map until the pin is on your door.</p>
          <div className="min-w-0">
            <MapPicker value={pin} onChange={onPin} autoLocate={!pin} fallbackPincode={p.pincode.trim() || pincodes[0]} coverage={coverage} error={errors.pin} />
          </div>
          {where?.status === "near" && (
            <label className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm">
              <input type="checkbox" checked={nearOk} onChange={(e) => { setNearOk(e.target.checked); setErrors((x) => ({ ...x, near: "" })); }} className="mt-0.5 h-4 w-4 shrink-0 accent-forest-900" />
              <span className="min-w-0">
                Deliver here anyway ({where.distanceM} m outside our area)
                {errors.near && <span className="block text-xs text-bad">{errors.near}</span>}
              </span>
            </label>
          )}
          <Field label="House / flat, street, area" htmlFor="paddress" error={errors.address}>
            <textarea id="paddress" className="input min-h-20 text-base sm:text-[15px]" rows={2} autoComplete="street-address" value={p.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,7.5rem)] gap-2.5">
            <Field label="Landmark" htmlFor="plandmark" optional>
              <input id="plandmark" className="input text-base sm:text-[15px]" value={p.landmark} onChange={(e) => set("landmark", e.target.value)} />
            </Field>
            <Field label="PIN code" htmlFor="ppincode" error={errors.pincode}>
              <input id="ppincode" className="input num text-base sm:text-[15px]" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={p.pincode} onChange={(e) => set("pincode", e.target.value)} />
            </Field>
          </div>
        </Section>
      )}

      {errors.form && <Note tone="bad">{errors.form}</Note>}
      <Button type="submit" variant="sage" size="lg" loading={busy} disabled={!ready} className="w-full">
        {!emailOk ? "Verify your email to continue" : verifyOnly ? "Continue to order" : "Finish and continue"}
      </Button>
    </form>
  );
}

/** One numbered block of the details step; the number turns into a tick when it's done. */
function Section({ n, title, done, note, action, children }: { n: number; title: string; done: boolean; note?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card flex min-w-0 flex-col gap-3">
      <header className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
        <span
          className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition", done ? "bg-good text-paper" : "bg-mint-100 text-forest-900")}
          aria-hidden="true"
        >
          {done ? <IconCheck width={13} height={13} /> : n}
        </span>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {note && <span className="text-xs text-ink-3">{note}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/** Same rule as the server: 8+ characters with a letter and a number. */
function pwProblem(v: string): string | null {
  if (v.length < 8) return "Use at least 8 characters.";
  if (v.length > 128) return "Keep it under 128 characters.";
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Use at least one letter and one number.";
  return null;
}
