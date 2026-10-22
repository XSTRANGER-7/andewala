"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { cn } from "@/lib/cn";
import {
  completeSignupAction,
  passwordLoginAction,
  requestCodeAction,
  saveProfileAction,
  setPasswordAction,
  signUpAction,
  verifyCodeAction,
} from "@/server/actions/account";
import dynamic from "next/dynamic";
import type { LatLng, PlaceGuess } from "@/lib/geo";
import { coverageAt, usesZones, type Coverage } from "@/lib/zones";
import { PhoneVerify } from "./PhoneVerify";

// The map library only runs in the browser.
const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="grid h-64 place-items-center rounded-xl border border-line bg-mint-100 text-sm text-ink-3">Loading map…</div>,
});

type Step = "auth" | "otp" | "otpcode" | "profile";
export type ResumeProfile = { name: string; email: string | null; hasAddress: boolean; hasPassword: boolean; phone: string | null; phoneVerified: boolean };

const GOOGLE_ERRORS: Record<string, string> = {
  expired: "Google sign-in took too long or was interrupted. Please try again.",
  failed: "We couldn't sign you in with Google. Please try again.",
  unverified: "Your Google account's email isn't verified. Use another sign-in option.",
};

/**
 * Sign up and log in with email + password (or Google). Then, once: name,
 * a verified mobile number (compulsory) and the first delivery address.
 * Older mobile-only accounts can still log in with a mobile OTP.
 */
export function LoginForm({ next, coverage, resumeProfile, google, googleError }: { next: string; coverage: Coverage; resumeProfile?: ResumeProfile; google: boolean; googleError?: string }) {
  const pincodes = usesZones(coverage) ? [] : coverage.pincodes;
  const router = useRouter();
  const [step, setStep] = useState<Step>(resumeProfile ? "profile" : "auth");
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>(googleError && GOOGLE_ERRORS[googleError] ? { form: GOOGLE_ERRORS[googleError] } : {});
  const [busy, setBusy] = useState(false);

  // mobile OTP login (older accounts)
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /** After logging in: riders choose a mode; finished profiles continue; otherwise the details step (fresh from the server). */
  function afterLogin(data: { complete: boolean; rider: boolean }) {
    if (data.rider) {
      router.replace("/mode");
      router.refresh();
    } else if (data.complete) {
      router.replace(next);
      router.refresh();
    } else {
      // A full load so the server sends the new account's details step (the session cookie is now set).
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (tab === "signup") {
      const problem = pwProblem(password) ?? (password !== password2 ? "The two passwords don't match." : null);
      if (problem) return setErrors({ password: problem });
      setBusy(true);
      const r = await signUpAction(email, password);
      if (!r.ok) {
        setBusy(false);
        return setErrors(r.errors);
      }
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setBusy(true);
    const r = await passwordLoginAction(email, password);
    if (!r.ok) {
      setBusy(false);
      return setErrors({ password: r.errors.password ?? r.errors.email ?? "Email or password is wrong." });
    }
    afterLogin(r.data);
  }

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setErrors({});
    const r = await requestCodeAction(phone);
    setBusy(false);
    if (!r.ok) return setErrors({ phone: r.errors.contact ?? "We couldn't send the code." });
    setDevCode(r.data.devCode);
    setCode("");
    setCooldown(120);
    setStep("otpcode");
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const r = await verifyCodeAction(phone, code);
    if (!r.ok) {
      setBusy(false);
      return setErrors({ code: r.errors.code ?? "That code isn't right." });
    }
    afterLogin(r.data);
  }

  if (step === "profile" && resumeProfile) return <ProfileStep next={next} coverage={coverage} pincodes={pincodes} resume={resumeProfile} />;

  if (step === "otp" || step === "otpcode") {
    return (
      <div className="grid gap-4">
        {step === "otp" ? (
          <form onSubmit={sendOtp} className="grid gap-4" noValidate>
            <p className="text-sm text-ink-2">For accounts made with a mobile number before passwords. New here? Sign up with email instead.</p>
            <Field label="Mobile number" htmlFor="otp-phone" error={errors.phone}>
              <input id="otp-phone" className="input num" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))} />
            </Field>
            <Button type="submit" variant="sage" size="lg" loading={busy} disabled={phone.replace(/\D/g, "").length !== 10}>
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="grid gap-4" noValidate>
            <p className="text-sm text-ink-2">Enter the code sent to +91 {phone.replace(/\D/g, "")}.</p>
            {devCode && (
              <Note tone="info">
                Development mode, no SMS provider set up: your code is <b className="num">{devCode}</b>
              </Note>
            )}
            <Field label="6-digit code" htmlFor="otp-code" error={errors.code}>
              <input id="otp-code" ref={codeRef} className="input num text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </Field>
            <Button type="submit" variant="sage" size="lg" loading={busy} disabled={code.length !== 6}>
              Log in
            </Button>
            <p className="text-center text-xs text-ink-3">
              {cooldown > 0 ? `Resend in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}` : (
                <button type="button" className="font-semibold text-forest-900 hover:underline" onClick={() => sendOtp()}>
                  Send a new code
                </button>
              )}
            </p>
          </form>
        )}
        <button type="button" className="text-center text-sm font-semibold text-forest-900 hover:underline" onClick={() => { setStep("auth"); setErrors({}); }}>
          ← Back to email and password
        </button>
      </div>
    );
  }

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
      <div className="grid grid-cols-2 rounded-xl bg-mint-100 p-1" role="tablist" aria-label="Log in or sign up">
        {(["login", "signup"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setErrors({}); }}
            className={cn("rounded-lg py-2 text-sm font-semibold transition", tab === t ? "bg-paper text-forest-900 shadow" : "text-ink-2 hover:text-ink")}
          >
            {t === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

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

      <form onSubmit={submitAuth} className="grid gap-4" noValidate>
        <Field label="Email" htmlFor="auth-email" error={errors.email}>
          <input id="auth-email" className="input" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={tab === "signup" ? "Create a password" : "Password"} htmlFor="auth-pw" error={tab === "signup" ? errors.password : undefined} hint={tab === "signup" ? "8+ characters with a letter and a number." : undefined}>
          {pwInput("auth-pw", password, setPassword, tab === "signup" ? "new-password" : "current-password")}
        </Field>
        {tab === "signup" && (
          <Field label="Confirm password" htmlFor="auth-pw2">
            {pwInput("auth-pw2", password2, setPassword2, "new-password")}
          </Field>
        )}
        {tab === "login" && errors.password && (
          <p className="text-sm text-bad" role="alert">
            {errors.password}
          </p>
        )}
        {errors.form && <Note tone="bad">{errors.form}</Note>}
        <Button type="submit" variant="sage" size="lg" loading={busy} disabled={!/\S+@\S+\.\S+/.test(email) || !password || (tab === "signup" && !password2)}>
          {tab === "signup" ? "Create account" : "Log in"}
        </Button>
        {tab === "signup" && <p className="text-xs text-ink-3">Next, you&apos;ll verify your mobile number and add your delivery address.</p>}
      </form>

      <button type="button" className="text-center text-sm font-semibold text-forest-900 hover:underline" onClick={() => { setStep("otp"); setErrors({}); }}>
        {tab === "login" ? "Forgot password, or no password yet? Log in with mobile OTP" : "Already have a mobile-number account? Log in with OTP"}
      </button>
    </div>
  );
}

/** Once, after the first login: name, password (if none), verified mobile (compulsory) and the first address. */
function ProfileStep({ next, coverage, pincodes, resume }: { next: string; coverage: Coverage; pincodes: string[]; resume: ResumeProfile }) {
  const router = useRouter();
  const needsAddress = !resume.hasAddress;
  const needsPassword = !resume.hasPassword;
  const [p, setP] = useState({ name: resume.name ?? "", email: resume.email ?? "", label: "Home", address: "", landmark: "", pincode: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(resume.phoneVerified ? resume.phone : null);
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
    if (!verifiedPhone) return setErrors({ phone: "Verify your mobile number to continue." });
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
        ? await completeSignupAction({ ...p, lat: pin.lat, lng: pin.lng, ...(needsPassword ? { password: pw } : {}) })
        : await saveProfileAction({ name: p.name, email: p.email });
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
    router.replace(next);
    router.refresh();
  }

  const ready =
    !!verifiedPhone &&
    p.name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(p.email) &&
    (!needsAddress || (!!pin && p.address.trim().length >= 8 && /^\d{6}$/.test(p.pincode.trim()))) &&
    (!needsPassword || (pw.length > 0 && pw2.length > 0));

  return (
    <form onSubmit={finish} className="grid gap-4" noValidate>
      <div>
        <h2 className="font-display text-lg font-bold">Your details</h2>
        <p className="text-sm text-ink-2">One time only. We use these for every delivery.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" htmlFor="pname" error={errors.name}>
          <input id="pname" className="input" autoComplete="name" autoFocus value={p.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="pemail" error={errors.email} hint={resume.email ? "Your login email." : "For order updates and logging in."}>
          <input id="pemail" className="input" type="email" autoComplete="email" value={p.email} disabled={!!resume.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </div>

      <PhoneVerify verifiedPhone={verifiedPhone} onVerified={(ph) => { setVerifiedPhone(ph); setErrors((x) => ({ ...x, phone: "" })); }} error={errors.phone} />

      {needsPassword && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Create a password" htmlFor="pw-new" error={errors.password} hint="8+ characters with a letter and a number.">
            <input id="pw-new" className="input" type={showPw ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErrors((x) => ({ ...x, password: "" })); }} />
          </Field>
          <Field label="Confirm password" htmlFor="pw-new2">
            <input id="pw-new2" className="input" type={showPw ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErrors((x) => ({ ...x, password: "" })); }} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-ink-2 sm:col-span-2">
            <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="h-4 w-4 accent-forest-900" />
            Show password
          </label>
        </div>
      )}

      {needsAddress && (
        <fieldset className="grid gap-3 border-t border-line pt-4">
          <legend className="sr-only">Delivery address</legend>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Delivery address</p>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Address label">
              {["Home", "Work", "Other"].map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={p.label === l}
                  onClick={() => set("label", l)}
                  className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold transition", p.label === l ? "border-forest-900 bg-mint-100 text-forest-900" : "border-line text-ink-2 hover:border-ink-3")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold">Pin your exact location</span>
            <span className="text-xs text-ink-3">We start at your current location. If the pin isn&apos;t on your door, move the map until it is.</span>
            <MapPicker value={pin} onChange={onPin} autoLocate={!pin} fallbackPincode={p.pincode.trim() || pincodes[0]} coverage={coverage} error={errors.pin} />
          </div>
          {where?.status === "near" && (
            <label className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm">
              <input type="checkbox" checked={nearOk} onChange={(e) => { setNearOk(e.target.checked); setErrors((x) => ({ ...x, near: "" })); }} className="mt-0.5 h-4 w-4 accent-forest-900" />
              <span>
                <b>Yes, deliver to this spot.</b> It&apos;s {where.distanceM} m outside our area, and we&apos;ll still bring your order here.
                {errors.near && <span className="block text-xs text-bad">{errors.near}</span>}
              </span>
            </label>
          )}
          <Field label="House / flat number, building, street and area" htmlFor="paddress" error={errors.address} hint="Filled in from the pin. Add your house or flat number.">
            <textarea id="paddress" className="input min-h-20" autoComplete="street-address" value={p.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Landmark" htmlFor="plandmark" optional>
              <input id="plandmark" className="input" value={p.landmark} onChange={(e) => set("landmark", e.target.value)} />
            </Field>
            <Field label="PIN code" htmlFor="ppincode" error={errors.pincode} hint={pincodes.length ? `We deliver to ${pincodes.join(", ")}` : undefined}>
              <input id="ppincode" className="input num" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={p.pincode} onChange={(e) => set("pincode", e.target.value)} />
            </Field>
          </div>
        </fieldset>
      )}

      {errors.form && <Note tone="bad">{errors.form}</Note>}
      <Button type="submit" variant="sage" size="lg" loading={busy} disabled={!ready}>
        {verifiedPhone ? "Finish and continue" : "Verify your mobile to continue"}
      </Button>
    </form>
  );
}

/** Same rule as the server: 8+ characters with a letter and a number. */
function pwProblem(v: string): string | null {
  if (v.length < 8) return "Use at least 8 characters.";
  if (v.length > 128) return "Keep it under 128 characters.";
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Use at least one letter and one number.";
  return null;
}
