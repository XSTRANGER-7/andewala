"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconCheck } from "@/components/ui/Icons";
import { Note } from "@/components/ui/Note";
import { sendEmailCodeAction, verifyEmailCodeAction } from "@/server/actions/account";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Verify the account's email with a 6-digit code. One code per 2 minutes and
 * 5 an hour (the server enforces both; the countdown just shows it).
 */
export function EmailVerify({ email, verified, onVerified, stay, error: outerError }: { email: string; verified: boolean; onVerified: () => void; stay?: boolean; error?: string }) {
  const [sent, setSent] = useState(false);
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

  async function send() {
    setBusy(true);
    setError("");
    const r = await sendEmailCodeAction();
    setBusy(false);
    if (!r.ok) {
      setError(r.errors.emailCode ?? "We couldn't send the code.");
      if (r.retryIn) setCooldown(r.retryIn);
      return;
    }
    setSent(true);
    setDevCode(r.data.devCode);
    setCode("");
    setCooldown(r.data.cooldown);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify() {
    setBusy(true);
    setError("");
    const r = await verifyEmailCodeAction(code, { stay });
    setBusy(false);
    if (!r.ok) return setError(r.errors.emailCode ?? "That code isn't right.");
    onVerified();
  }

  if (verified) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-mint-50 px-3 py-2.5 text-sm" data-email-verified="true">
        <b className="min-w-0 break-all font-medium">{email}</b>
        <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">
          <IconCheck width={11} height={11} /> Verified
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2.5" data-email-verified="false">
      {!sent ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-[1_1_12rem] break-all text-sm text-ink-2">
            We&apos;ll email a code to <b className="font-semibold text-ink">{email}</b>
          </p>
          <Button type="button" variant="primary" loading={busy} disabled={cooldown > 0} onClick={send} className="flex-[1_0_auto] sm:flex-none" data-send-email-code>
            {cooldown > 0 ? `Wait ${fmt(cooldown)}` : "Send code"}
          </Button>
        </div>
      ) : (
        <>
          <p className="break-all text-sm text-ink-2">
            Code sent to <b className="font-semibold text-ink">{email}</b>. Not in your inbox? Check <b className="font-semibold text-ink">Spam</b> or <b className="font-semibold text-ink">Promotions</b>, and mark it &ldquo;Not spam&rdquo;.
          </p>
          {devCode && (
            <Note tone="info">
              Test mode, your code is <b className="num">{devCode}</b>
            </Note>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              id="ev-code"
              ref={codeRef}
              className="input num min-w-0 flex-[1_1_9rem] text-center text-xl tracking-[0.3em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="······"
              aria-label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <Button type="button" variant="sage" loading={busy} disabled={code.length !== 6} onClick={verify} className="flex-[1_0_auto] sm:flex-none">
              Verify
            </Button>
          </div>
          <p className="text-xs text-ink-3">
            {cooldown > 0 ? (
              <>
                Resend in <b className="num">{fmt(cooldown)}</b>
              </>
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
