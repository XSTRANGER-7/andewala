import "server-only";
import { createTransport, type Transporter } from "nodemailer";

/**
 * Sends one-time codes.
 *
 * Email: your own mailbox over SMTP (Hostinger: SMTP_HOST=smtp.hostinger.com, SMTP_PORT=465,
 *        SMTP_USER=contact@andewala.store, SMTP_PASS, EMAIL_FROM), or Resend (RESEND_API_KEY + EMAIL_FROM).
 * SMS:   MSG91 (India, DLT-registered template) or Twilio. Set the keys for one of them.
 *
 * With no provider configured, development builds return the code so the login
 * screen can show it; production builds refuse, so codes are never exposed.
 */
export type Channel = "phone" | "email";
export type DeliveryResult = { ok: true; devCode?: string } | { ok: false; error: string };

const isProd = process.env.NODE_ENV === "production";

export function deliveryConfigured(channel: Channel): boolean {
  if (channel === "email") return smtpConfigured() || !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return !!((process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM));
}

export async function deliverCode(channel: Channel, target: string, code: string, storeName: string): Promise<DeliveryResult> {
  if (!deliveryConfigured(channel)) {
    if (isProd) {
      return { ok: false, error: channel === "phone" ? "Mobile codes aren't available yet." : "Email codes aren't available right now. Try again later." };
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

const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: Transporter | null = null;
function smtp(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transport = createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transport;
}

/** A small code email: plain text plus a few lines of inline-styled HTML (no images, no tracking). */
function codeEmail(code: string, storeName: string) {
  const subject = `${code} is your ${storeName} code`;
  const text = `Your ${storeName} verification code is ${code}

It expires in 10 minutes. If you didn't ask for it, ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#1d2b24;max-width:420px"><p style="margin:0 0 8px">Your ${storeName} verification code</p><p style="margin:0 0 12px;font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p style="margin:0;font-size:13px;color:#5b6b63">Expires in 10 minutes. Didn't ask for it? Ignore this email.</p></div>`;
  return { subject, text, html };
}

async function sendEmail(to: string, code: string, storeName: string) {
  const from = process.env.EMAIL_FROM || `${storeName} <${process.env.SMTP_USER}>`;
  const mail = codeEmail(code, storeName);
  if (smtpConfigured()) {
    await smtp().sendMail({ from, to, ...mail });
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, ...mail }),
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
  if (/EAUTH|535|Invalid login/i.test(message)) return "The mail server rejected SMTP_USER / SMTP_PASS. Use the mailbox password from Hostinger > Emails.";
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ESOCKET/i.test(message)) return "Couldn't reach the mail server. Check SMTP_HOST (smtp.hostinger.com) and SMTP_PORT (465).";
  if (/21608|unverified/i.test(message)) return "Your Twilio account is a trial, which can only text verified numbers. Verify this number in Twilio Console > Phone Numbers > Manage > Verified Caller IDs, or upgrade the account.";
  if (/21408|permission to send/i.test(message)) return "Twilio isn't allowed to send SMS to India from this account. Enable India in Twilio Console > Messaging > Settings > Geo permissions.";
  if (/21211|invalid .*'to'/i.test(message)) return "Twilio says this mobile number is invalid.";
  if (/20003|authenticat/i.test(message)) return "Twilio rejected TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in .env.";
  if (/21606|21212|from/i.test(message)) return "TWILIO_FROM isn't a number this Twilio account can send from.";
  return message.slice(0, 300);
}
