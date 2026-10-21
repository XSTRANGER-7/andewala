import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import { deliverCode, type Channel } from "./otp-delivery";
import { supabaseCheckCode, supabaseOtpEnabled, supabaseSendCode } from "./supabase-auth";
import { twilioCheckCode, twilioSendCode, twilioVerifyEnabled } from "./twilio-verify";
import { getSettings } from "./settings";

/**
 * Customer login with one-time codes.
 *
 * - Sign-up is by mobile number only: an unknown mobile creates an account.
 * - Existing accounts can log in with their mobile number or their email.
 *   An email that belongs to no account is refused before any code is sent.
 *
 * - Codes are 6 digits, valid 10 minutes, single use, 5 wrong tries max.
 * - Only an HMAC of the code is stored. When Supabase Auth handles a channel
 *   (SUPABASE_AUTH_OTP), Supabase creates, sends and checks the code instead,
 *   and the row here only carries the rate limits and attempt count.
 * - Rate limits: 1 code per 30 s per contact, 5 per hour per contact, 20 per hour per IP.
 * - A successful login creates a Session row; the cookie holds its id plus a signature,
 *   so sessions can be revoked (log out) and can't be forged.
 */
export const SESSION_COOKIE = "egg_session";
const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/** Stored instead of a hash when Supabase Auth owns the code. */
const SUPABASE_MARK = "supabase";
/** Stored instead of a hash when Twilio Verify owns the code. */
const TWILIO_MARK = "twilio-verify";

export type CustomerUser = { id: string; name: string; phone: string | null; email: string | null };

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set to at least 16 characters.");
  return s;
}
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");
const hashCode = (target: string, code: string) => createHmac("sha256", secret()).update(`${target}:${code}`).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Work out whether the input is a mobile number or an email, and normalise it. */
export function parseContact(raw: string): { channel: Channel; target: string } | null {
  const v = raw.trim();
  if (v.includes("@")) {
    const email = v.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120 ? { channel: "email", target: email } : null;
  }
  const digits = v.replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? { channel: "phone", target: digits } : null;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64);
}

export type RequestCodeResult =
  | { ok: true; channel: Channel; target: string; devCode?: string; isNew: boolean }
  | { ok: false; error: string; retryIn?: number; code?: "email_not_found" };

export async function requestCode(raw: string): Promise<RequestCodeResult> {
  const contact = parseContact(raw);
  if (!contact) return { ok: false, error: "Enter a 10-digit mobile number or a valid email address." };
  const { channel, target } = contact;
  const existing = await prisma.user.findUnique({ where: channel === "phone" ? { phone: target } : { email: target }, select: { id: true } });
  if (channel === "email" && !existing) {
    return { ok: false, code: "email_not_found", error: "No account uses this email. New here? Sign up with your mobile number." };
  }
  const ip = await clientIp();
  const now = Date.now();

  const last = await prisma.otpCode.findFirst({ where: { target }, orderBy: { createdAt: "desc" } });
  if (last && now - last.createdAt.getTime() < 30_000) {
    const retryIn = Math.ceil((30_000 - (now - last.createdAt.getTime())) / 1000);
    return { ok: false, error: `Please wait ${retryIn}s before asking for another code.`, retryIn };
  }
  const hourAgo = new Date(now - 3600_000);
  const [perTarget, perIp] = await Promise.all([
    prisma.otpCode.count({ where: { target, createdAt: { gte: hourAgo } } }),
    ip ? prisma.otpCode.count({ where: { ip, createdAt: { gte: hourAgo } } }) : Promise.resolve(0),
  ]);
  if (perTarget >= 5 || perIp >= 20) return { ok: false, error: "Too many codes requested. Try again in an hour." };

  const viaSupabase = supabaseOtpEnabled(channel);
  const viaTwilio = !viaSupabase && channel === "phone" && twilioVerifyEnabled();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  let devCode: string | undefined;
  if (viaSupabase) {
    const sent = await supabaseSendCode(channel, target);
    if (!sent.ok) return { ok: false, error: sent.error };
  } else if (viaTwilio) {
    const sent = await twilioSendCode(target);
    if (!sent.ok) return { ok: false, error: process.env.NODE_ENV !== "production" ? `Setup problem (shown in development only): ${sent.detail}` : sent.error };
  } else {
    const { storeName } = await getSettings();
    const sent = await deliverCode(channel, target, code, storeName);
    if (!sent.ok) return { ok: false, error: sent.error };
    devCode = sent.devCode;
  }

  // Only the newest code for a contact is valid.
  await prisma.otpCode.updateMany({ where: { target, consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.otpCode.create({
    data: { channel, target, codeHash: viaSupabase ? SUPABASE_MARK : viaTwilio ? TWILIO_MARK : hashCode(target, code), expiresAt: new Date(now + CODE_TTL_MS), ip },
  });
  return { ok: true, channel, target, devCode, isNew: !existing };
}

export type VerifyResult = { ok: true; user: CustomerUser; isNew: boolean } | { ok: false; error: string };

export async function verifyCode(raw: string, code: string): Promise<VerifyResult> {
  const contact = parseContact(raw);
  const clean = code.replace(/\D/g, "");
  if (!contact || clean.length !== 6) return { ok: false, error: "Enter the 6-digit code." };
  const { channel, target } = contact;

  const otp = await prisma.otpCode.findFirst({ where: { target, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt < new Date()) return { ok: false, error: "That code has expired. Ask for a new one." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many wrong tries. Ask for a new code." };
  let right: boolean;
  if (otp.codeHash === SUPABASE_MARK || otp.codeHash === TWILIO_MARK) {
    const r = otp.codeHash === SUPABASE_MARK ? await supabaseCheckCode(channel, target, clean) : await twilioCheckCode(target, clean);
    if (r === "error") return { ok: false, error: "We couldn't check the code right now. Try again in a moment." };
    right = r === "ok";
  } else {
    right = safeEqual(otp.codeHash, hashCode(target, clean));
  }
  if (!right) {
    const left = MAX_ATTEMPTS - otp.attempts - 1;
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: left > 0 ? `That code isn't right. ${left} tr${left === 1 ? "y" : "ies"} left.` : "Too many wrong tries. Ask for a new code." };
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const where = channel === "phone" ? { phone: target } : { email: target };
  const verified = channel === "phone" ? { phoneVerifiedAt: new Date() } : { emailVerifiedAt: new Date() };
  const existing = await prisma.user.findUnique({ where });
  // Email can only log in to an existing account; new accounts are created by mobile number.
  if (!existing && channel === "email") return { ok: false, error: "No account uses this email. Sign up with your mobile number." };
  const user = existing ? await prisma.user.update({ where: { id: existing.id }, data: verified }) : await prisma.user.create({ data: { ...where, ...verified } });

  await startSession(user.id);
  return { ok: true, user: pick(user), isNew: !existing || !existing.name };
}

async function startSession(userId: string) {
  const h = await headers();
  const session = await prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000), userAgent: (h.get("user-agent") ?? "").slice(0, 200) },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, `${session.id}.${sign(session.id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

function pick(u: { id: string; name: string; phone: string | null; email: string | null }): CustomerUser {
  return { id: u.id, name: u.name, phone: u.phone, email: u.email };
}

async function sessionId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  return id && sig && safeEqual(sig, sign(id)) ? id : null;
}

/** The logged-in customer, or null. */
export async function getUser(): Promise<CustomerUser | null> {
  const id = await sessionId();
  if (!id) return null;
  const s = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return pick(s.user);
}

export async function requireUser(): Promise<CustomerUser> {
  const u = await getUser();
  if (!u) throw new Error("Please log in to continue.");
  return u;
}

export async function endSession(): Promise<void> {
  const id = await sessionId();
  if (id) await prisma.session.deleteMany({ where: { id } });
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
