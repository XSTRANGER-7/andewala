import "server-only";
import type { Channel } from "./otp-delivery";

/**
 * Optional: let Supabase Auth send and check the one-time login codes.
 *
 * Turn it on per channel with SUPABASE_AUTH_OTP="phone" (or "phone,email").
 * Supabase then sends the SMS through the provider set up in the Supabase
 * dashboard (Authentication > Providers > Phone: Twilio, MessageBird, Vonage
 * or Textlocal) and checks the code. For email, the "Magic Link" email
 * template must show {{ .Token }} so it sends a 6-digit code, and a custom
 * SMTP server is needed (Supabase's built-in mailer only delivers to the
 * project team's own addresses).
 *
 * Only the code exchange goes through Supabase. Accounts, profiles, addresses
 * and login sessions stay in this app's own database tables.
 */
const url = () => process.env.SUPABASE_URL?.replace(/\/+$/, "") ?? "";
const key = () => process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

export function supabaseOtpEnabled(channel: Channel): boolean {
  if (!url() || !key()) return false;
  const channels = (process.env.SUPABASE_AUTH_OTP ?? "").split(",").map((c) => c.trim().toLowerCase());
  return channels.includes(channel);
}

const body = (channel: Channel, target: string) => (channel === "phone" ? { phone: `+91${target}` } : { email: target });

async function call(path: string, payload: unknown): Promise<{ ok: boolean; status: number; message: string }> {
  const res = await fetch(`${url()}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key(), Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
  if (!res) return { ok: false, status: 0, message: "network" };
  if (res.ok) return { ok: true, status: res.status, message: "" };
  const j = (await res.json().catch(() => ({}))) as { msg?: string; message?: string; error_description?: string; error?: string };
  return { ok: false, status: res.status, message: j.msg ?? j.message ?? j.error_description ?? j.error ?? `HTTP ${res.status}` };
}

/** Ask Supabase to send a code. */
export async function supabaseSendCode(channel: Channel, target: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await call("otp", { ...body(channel, target), create_user: true });
  if (res.ok) return { ok: true };
  console.error("Supabase OTP send failed", res.status, res.message);
  if (res.status === 429) return { ok: false, error: "Too many codes requested. Try again in a few minutes." };
  if (process.env.NODE_ENV !== "production") return { ok: false, error: `Setup problem (shown in development only): ${explainSmsError(res.message)}` };
  return { ok: false, error: "We couldn't send the code. Check the details and try again in a minute." };
}

/** Turn a provider error into the fix, for development builds. */
function explainSmsError(message: string): string {
  if (/21212|Invalid From Number/i.test(message) && /\bPN[0-9a-f]{32}\b/i.test(message)) {
    return "Supabase is using your Twilio phone number ID (PN...) where it needs a Messaging Service SID (MG...). In Supabase > Authentication > Sign In / Providers > Phone, put an MG... Messaging Service SID, or switch the provider to Twilio Verify. Or skip Supabase: set SUPABASE_AUTH_OTP=\"\" and the TWILIO_VERIFY_SERVICE_SID keys in .env.";
  }
  if (/21608|unverified/i.test(message)) return "Your Twilio trial can only text verified numbers. Add this number under Twilio > Phone Numbers > Verified Caller IDs, or upgrade the Twilio account.";
  if (/20003|authenticat/i.test(message)) return "Twilio rejected the Account SID or Auth Token saved in Supabase's Phone settings.";
  if (/21211|invalid .*to/i.test(message)) return "Twilio says this mobile number is invalid.";
  return message;
}

/** Ask Supabase whether the code is right. */
export async function supabaseCheckCode(channel: Channel, target: string, code: string): Promise<"ok" | "wrong" | "error"> {
  const res = await call("verify", { ...body(channel, target), token: code, type: channel === "phone" ? "sms" : "email" });
  if (res.ok) return "ok";
  // Supabase answers 400/403 for a wrong or expired code.
  if (res.status === 400 || res.status === 401 || res.status === 403) return "wrong";
  console.error("Supabase OTP verify failed", res.status, res.message);
  return "error";
}
