"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconCheck } from "@/components/ui/Icons";
import { Note } from "@/components/ui/Note";
import { cn } from "@/lib/cn";
import { sendPhoneCodeAction, verifyPhoneCodeAction } from "@/server/actions/account";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Verify a mobile number with a 6-digit code. One code per 2 minutes, 5 an
 * hour (the server enforces both; the countdown just shows it).
 */
export function PhoneVerify({ verifiedPhone, onVerified, error: outerError, stay, compact }: { verifiedPhone: string | null; onVerified: (phone: string) => void; error?: string; stay?: boolean; compact?: boolean }) {
  const [editing, setEditing] = useState(!verifiedPhone);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const digits = phone.replace(/\D/g, "").slice(-10);

  async function send() {
    setBusy(true);
    setError("");
    const r = await sendPhoneCodeAction(digits);
    setBusy(false);
    if (!r.ok) {
      setError(r.errors.phone ?? "We couldn't send the code.");
      if (r.retryIn) setCooldown(r.retryIn);
      return;
    }
    setSentTo(digits);
    setDevCode(r.data.devCode);
    setCode("");
    setCooldown(r.data.cooldown);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify() {
    if (!sentTo) return;
    setBusy(true);
    setError("");
    const r = await verifyPhoneCodeAction(sentTo, code, { stay });
    setBusy(false);
    if (!r.ok) return setError(r.errors.code ?? "That code isn't right.");
    setEditing(false);
    onVerified(sentTo);
  }

  if (!editing && verifiedPhone) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-mint-50 px-3 py-2.5 text-sm" data-phone-verified="true">
        {!compact && <span className="text-ink-3">Mobile</span>}
        <b className="num">+91 {verifiedPhone}</b>
        <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">
          <IconCheck width={11} height={11} /> Verified
        </span>
        <button type="button" className="ml-auto text-xs font-semibold text-forest-900 hover:underline" onClick={() => { setEditing(true); setSentTo(null); setPhone(""); }}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5", !compact && "rounded-xl border border-line p-3")} data-phone-verified="false">
      {!compact && (
        <p className="text-sm font-semibold">
          Verify your mobile number <span className="font-normal text-ink-3">(required: the rider calls this number)</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-0 flex-[1_1_11rem] items-stretch overflow-hidden rounded-lg border border-line bg-paper focus-within:border-forest-700 focus-within:ring-[3px] focus-within:ring-forest-700/20">
          <span className="num grid place-items-center border-r border-line bg-mint-50 px-3 text-[15px] font-semibold text-ink-2">+91</span>
          <input
            id="pv-phone"
            className="num min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base tracking-wide outline-none sm:text-[15px]"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            maxLength={11}
            value={phone}
            disabled={!!sentTo}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))}
            aria-label="Mobile number"
          />
        </div>
        {!sentTo ? (
          <Button type="button" variant="primary" loading={busy} disabled={digits.length !== 10 || cooldown > 0} onClick={send} className="flex-[1_0_auto] sm:flex-none">
            {cooldown > 0 ? `Wait ${fmt(cooldown)}` : "Send code"}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => { setSentTo(null); setCode(""); setError(""); }} className="flex-[1_0_auto] sm:flex-none">
            Edit
          </Button>
        )}
      </div>
      {sentTo && (
        <>
          {devCode && (
            <Note tone="info">
              Test mode, your code is <b className="num">{devCode}</b>
            </Note>
          )}
          <Field label={`Code sent to +91 ${sentTo}`} htmlFor="pv-code">
            <div className="flex flex-wrap gap-2">
              <input
                id="pv-code"
                ref={codeRef}
                className="input num min-w-0 flex-[1_1_9rem] text-center text-xl tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <Button type="button" variant="sage" loading={busy} disabled={code.length !== 6} onClick={verify} className="flex-[1_0_auto] sm:flex-none">
                Verify
              </Button>
            </div>
          </Field>
          <p className="text-xs text-ink-3" data-resend>
            Didn&apos;t get it?{" "}
            {cooldown > 0 ? (
              <span>
                Resend in <b className="num">{fmt(cooldown)}</b>
              </span>
            ) : (
              <button type="button" className="font-semibold text-forest-900 hover:underline" onClick={send} disabled={busy}>
                Send a new code
              </button>
            )}
          </p>
        </>
      )}
      {(error || outerError) && <p className="text-xs text-bad" role="alert">{error || outerError}</p>}
    </div>
  );
}
