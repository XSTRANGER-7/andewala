import "server-only";

/**
 * Sends one-time login codes.
 *
 * Email: Resend (free plan: 3,000 emails a month, 100 a day). Set RESEND_API_KEY and EMAIL_FROM.
 * SMS:   MSG91 (India, DLT-registered template) or Twilio. Set the keys for one of them.
 *
 * With no provider configured, development builds return the code so the login
 * screen can show it; production builds refuse, so codes are never exposed.
 */
export type Channel = "phone" | "email";
export type DeliveryResult = { ok: true; devCode?: string } | { ok: false; error: string };

const isProd = process.env.NODE_ENV === "production";

export function deliveryConfigured(channel: Channel): boolean {
  if (channel === "email") return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return !!((process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM));
}

export async function deliverCode(channel: Channel, target: string, code: string, storeName: string): Promise<DeliveryResult> {
  if (!deliveryConfigured(channel)) {
    if (isProd) {
      return { ok: false, error: channel === "phone" ? "Login by mobile isn't available yet. Use your email instead." : "Login by email isn't available yet. Use your mobile number instead." };
    }
    console.info(`[dev] ${storeName} login code for ${target}: ${code}`);
    return { ok: true, devCode: code };
  }
  try {
    if (channel === "email") await sendEmail(target, code, storeName);
    else await sendSms(target, code, storeName);
    return { ok: true };
  } catch (e) {
    console.error("OTP delivery failed", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (!isProd) return { ok: false, error: `Setup problem (shown in development only): ${explainProviderError(msg)}` };
    return { ok: false, error: "We couldn't send the code. Check the details and try again in a minute." };
  }
}

async function sendEmail(to: string, code: string, storeName: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject: `${code} is your ${storeName} login code`,
      text: `Your ${storeName} login code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this email.`,
      html: `<p>Your ${storeName} login code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you didn't ask for it, ignore this email.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendSms(phone10: string, code: string, storeName: string) {
  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
    // MSG91 Flow API; the template must contain a ##otp## variable and be DLT-approved.
    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { authkey: process.env.MSG91_AUTH_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, short_url: "0", recipients: [{ mobiles: `91${phone10}`, otp: code }] }),
    });
    if (!res.ok) throw new Error(`MSG91 ${res.status}: ${await res.text()}`);
    return;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: process.env.TWILIO_FROM!, To: `+91${phone10}`, Body: `${code} is your ${storeName} login code. It expires in 10 minutes.` }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

/** Turn an SMS/email provider error into the fix, for development builds. */
function explainProviderError(message: string): string {
  if (/21608|unverified/i.test(message)) return "Your Twilio account is a trial, which can only text verified numbers. Verify this number in Twilio Console > Phone Numbers > Manage > Verified Caller IDs, or upgrade the account.";
  if (/21408|permission to send/i.test(message)) return "Twilio isn't allowed to send SMS to India from this account. Enable India in Twilio Console > Messaging > Settings > Geo permissions.";
  if (/21211|invalid .*'to'/i.test(message)) return "Twilio says this mobile number is invalid.";
  if (/20003|authenticat/i.test(message)) return "Twilio rejected TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env.";
  if (/21606|21212|from/i.test(message)) return "TWILIO_FROM isn't a number this Twilio account can send from.";
  return message.slice(0, 300);
}
