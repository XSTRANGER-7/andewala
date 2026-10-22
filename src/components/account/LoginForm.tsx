"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { cn } from "@/lib/cn";
import { completeSignupAction, requestCodeAction, saveProfileAction, verifyCodeAction } from "@/server/actions/account";

type Step = "contact" | "code" | "profile";
export type ResumeProfile = { name: string; email: string | null; hasAddress: boolean };

/**
 * Log in with mobile or email (existing accounts), sign up with mobile only.
 * New customers then give their name, email and first delivery address.
 */
export function LoginForm({ next, pincodes, resumeProfile }: { next: string; pincodes: string[]; resumeProfile?: ResumeProfile }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(resumeProfile ? "profile" : "contact");
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [contact, setContact] = useState("");
  const [sentTo, setSentTo] = useState<{ channel: "phone" | "email"; target: string; isNew: boolean } | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [emailNotFound, setEmailNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);

  // profile step
  const [p, setP] = useState({ name: resumeProfile?.name ?? "", email: resumeProfile?.email ?? "", label: "Home", address: "", landmark: "", pincode: "" });
  const [pErrors, setPErrors] = useState<Record<string, string>>({});
  const needsAddress = !resumeProfile?.hasAddress;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setEmailNotFound(false);
    const res = await requestCodeAction(contact);
    setBusy(false);
    if (!res.ok) {
      setEmailNotFound(!!res.errors.emailNotFound);
      return setError(res.errors.contact ?? "Something went wrong.");
    }
    setSentTo({ channel: res.data.channel, target: res.data.target, isNew: res.data.isNew });
    setDevCode(res.data.devCode);
    setCode("");
    setStep("code");
    setCooldown(30);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const res = await verifyCodeAction(contact, code);
    if (!res.ok) {
      setBusy(false);
      return setError(res.errors.code ?? "That code isn't right.");
    }
    if (res.data.rider && (next === "/account" || next === "/")) {
      router.replace("/rider");
      router.refresh();
      return;
    }
    if (res.data.complete) {
      router.replace(next);
      router.refresh();
      return;
    }
    setBusy(false);
    setStep("profile");
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (pincodes.length && /^\d{6}$/.test(p.pincode.trim()) && !pincodes.includes(p.pincode.trim()) && needsAddress) {
      setPErrors({ pincode: `We don't deliver to ${p.pincode.trim()} yet. We deliver to ${pincodes.join(", ")}.` });
      return;
    }
    setBusy(true);
    setPErrors({});
    const res = needsAddress ? await completeSignupAction(p) : await saveProfileAction({ name: p.name, email: p.email });
    if (!res.ok) {
      setBusy(false);
      return setPErrors(res.errors);
    }
    router.replace(next);
    router.refresh();
  }

  const shown = sentTo ? (sentTo.channel === "phone" ? `+91 ${sentTo.target.slice(0, 5)} ${sentTo.target.slice(5)}` : sentTo.target) : "";

  if (step === "contact") {
    const switchMode = (m: "phone" | "email") => {
      setMode(m);
      setContact("");
      setError("");
      setEmailNotFound(false);
      setTimeout(() => contactRef.current?.focus(), 30);
    };
    const digits = contact.replace(/\D/g, "");
    const canSend = mode === "phone" ? digits.length === 10 : /\S+@\S+\.\S+/.test(contact.trim());
    return (
      <form onSubmit={send} className="grid gap-4" noValidate>
        {mode === "phone" ? (
          <Field label="Mobile number" htmlFor="contact" error={error} hint="We'll send a 6-digit code. New here? This creates your account.">
            <div className="flex items-stretch overflow-hidden rounded-lg border border-line bg-paper focus-within:border-forest-700 focus-within:ring-[3px] focus-within:ring-forest-700/20">
              <span className="num grid place-items-center border-r border-line bg-mint-50 px-3 text-[15px] font-semibold text-ink-2">+91</span>
              <input
                id="contact"
                ref={contactRef}
                className="num min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[15px] tracking-wide outline-none focus-visible:outline-none"
                autoFocus
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                maxLength={11}
                value={contact}
                onChange={(e) => setContact(e.target.value.replace(/[^\d ]/g, ""))}
              />
            </div>
          </Field>
        ) : (
          <Field label="Email" htmlFor="contact" error={error} hint="For existing accounts only. New customers sign up with a mobile number.">
            <input
              id="contact"
              ref={contactRef}
              className="input"
              autoFocus
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                if (emailNotFound) setEmailNotFound(false);
              }}
            />
          </Field>
        )}
        {emailNotFound && (
          <button type="button" className="w-max text-sm font-semibold text-forest-900 hover:underline" onClick={() => switchMode("phone")}>
            Sign up with my mobile number →
          </button>
        )}
        <Button type="submit" variant="sage" size="lg" loading={busy} disabled={!canSend}>
          {mode === "phone" ? "Continue" : "Send code"}
        </Button>
        <div className="flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>
        {mode === "phone" ? (
          <button type="button" className="text-center text-sm font-semibold text-forest-900 hover:underline" onClick={() => switchMode("email")}>
            Already have an account? Log in with email
          </button>
        ) : (
          <button type="button" className="text-center text-sm font-semibold text-forest-900 hover:underline" onClick={() => switchMode("phone")}>
            Use mobile number instead
          </button>
        )}
      </form>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="grid gap-4" noValidate>
        <p className="text-sm text-ink-2">
          {sentTo?.isNew ? "Creating your account. " : ""}Enter the code sent to <b className="text-ink">{shown}</b>.{" "}
          <button type="button" className="font-semibold text-forest-900 underline-offset-2 hover:underline" onClick={() => setStep("contact")}>
            Change
          </button>
        </p>
        {devCode && (
          <Note tone="info">
            Development mode, no {sentTo?.channel === "phone" ? "SMS" : "email"} provider set up: your code is <b className="num">{devCode}</b>
          </Note>
        )}
        <Field label="6-digit code" htmlFor="code" error={error}>
          <input
            id="code"
            ref={codeRef}
            className="input num text-center text-2xl tracking-[0.5em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </Field>
        <Button type="submit" variant="sage" size="lg" loading={busy} disabled={code.length !== 6}>
          Verify and continue
        </Button>
        <p className="text-center text-xs text-ink-3">
          Didn&apos;t get it?{" "}
          {cooldown > 0 ? (
            <span>Resend in {cooldown}s</span>
          ) : (
            <button type="button" className="font-semibold text-forest-900 hover:underline" onClick={() => send()}>
              Send a new code
            </button>
          )}
        </p>
      </form>
    );
  }

  const set = (k: keyof typeof p, v: string) => {
    setP((x) => ({ ...x, [k]: v }));
    setPErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };
  const ready = p.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(p.email) && (!needsAddress || (p.address.trim().length >= 8 && /^\d{6}$/.test(p.pincode.trim())));

  return (
    <form onSubmit={finish} className="grid gap-4" noValidate>
      <div>
        <h2 className="font-display text-lg font-bold">Your details</h2>
        <p className="text-sm text-ink-2">One time only. We use these for every delivery.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" htmlFor="pname" error={pErrors.name}>
          <input id="pname" className="input" autoComplete="name" autoFocus value={p.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="pemail" error={pErrors.email} hint="For order updates. You can also log in with it.">
          <input id="pemail" className="input" type="email" autoComplete="email" value={p.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </div>

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
          <Field label="House, street and area" htmlFor="paddress" error={pErrors.address}>
            <textarea id="paddress" className="input min-h-20" autoComplete="street-address" value={p.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Landmark" htmlFor="plandmark" optional>
              <input id="plandmark" className="input" value={p.landmark} onChange={(e) => set("landmark", e.target.value)} />
            </Field>
            <Field label="PIN code" htmlFor="ppincode" error={pErrors.pincode} hint={pincodes.length ? `We deliver to ${pincodes.join(", ")}` : undefined}>
              <input id="ppincode" className="input num" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={p.pincode} onChange={(e) => set("pincode", e.target.value)} />
            </Field>
          </div>
        </fieldset>
      )}

      {pErrors.form && <Note tone="bad">{pErrors.form}</Note>}
      <Button type="submit" variant="sage" size="lg" loading={busy} disabled={!ready}>
        Create my account
      </Button>
    </form>
  );
}
