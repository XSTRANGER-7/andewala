import "server-only";

/**
 * Optional: send and check mobile login codes with Twilio Verify directly,
 * without going through Supabase's phone settings.
 *
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID
 * (starts with "VA", from Twilio Console > Verify > Services). Twilio Verify
 * sends from Twilio's own registered senders and templates, which is the
 * easiest route for Indian numbers.
 */
const sid = () => process.env.TWILIO_ACCOUNT_SID ?? "";
const token = () => process.env.TWILIO_AUTH_TOKEN ?? "";
const service = () => process.env.TWILIO_VERIFY_SERVICE_SID ?? "";

export function twilioVerifyEnabled(): boolean {
  return !!(sid() && token() && service().startsWith("VA"));
}

async function call(path: string, params: Record<string, string>) {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${service()}/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid()}:${token()}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  }).catch(() => null);
  if (!res) return { ok: false, status: 0, body: {} as Record<string, unknown> };
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

export async function twilioSendCode(phone10: string): Promise<{ ok: true } | { ok: false; error: string; detail: string }> {
  const r = await call("Verifications", { To: `+91${phone10}`, Channel: "sms" });
  if (r.ok) return { ok: true };
  const detail = `Twilio Verify ${r.status} ${r.body.code ?? ""}: ${r.body.message ?? "no response"}`;
  console.error("Twilio Verify send failed", detail);
  if (r.status === 429) return { ok: false, error: "Too many codes requested. Try again in a few minutes.", detail };
  return { ok: false, error: "We couldn't send the code. Check the number and try again in a minute.", detail };
}

export async function twilioCheckCode(phone10: string, code: string): Promise<"ok" | "wrong" | "error"> {
  const r = await call("VerificationCheck", { To: `+91${phone10}`, Code: code });
  if (r.ok) return r.body.status === "approved" ? "ok" : "wrong";
  // 404: no pending verification (expired or already used).
  if (r.status === 404 || r.status === 400) return "wrong";
  console.error("Twilio Verify check failed", r.status, r.body.message);
  return "error";
}
