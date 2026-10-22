import "server-only";
import { MODE_COOKIE } from "./mode";
import { cache } from "react";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import { deliverCode, type Channel } from "./otp-delivery";
import { supabaseCheckCode, supabaseOtpEnabled, supabaseSendCode } from "./supabase-auth";
import { twilioCheckCode, twilioSendCode, twilioVerifyEnabled } from "./twilio-verify";
import { getSettings } from "./settings";
import { customerLoginBlocked, recordCustomerFailure } from "./guard";
import { hashPassword, verifyPassword } from "./password";
import { isOnboarded } from "./accounts";

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

export type CustomerUser = { id: string; name: string; phone: string | null; email: string | null; phoneVerified: boolean };

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

/** Wait at least this long between codes to the same number or email. */
export const CODE_COOLDOWN_MS = 120_000;
/** At most this many codes per number/email (and per account) in an hour. */
export const CODES_PER_HOUR = 5;

type Issued = { ok: true; devCode?: string } | { ok: false; error: string; retryIn?: number };

/**
 * Send a 6-digit code to a phone or email: one per 2 minutes and 5 an hour
 * per number/email, 5 an hour per account (`userId`), 20 an hour per network.
 * Only the newest code for a target is valid.
 */
async function issueCode(channel: Channel, target: string, userId: string | null): Promise<Issued> {
  const ip = await clientIp();
  const now = Date.now();
  const last = await prisma.otpCode.findFirst({ where: { target }, orderBy: { createdAt: "desc" } });
  if (last && now - last.createdAt.getTime() < CODE_COOLDOWN_MS) {
    const retryIn = Math.ceil((CODE_COOLDOWN_MS - (now - last.createdAt.getTime())) / 1000);
    return { ok: false, error: `Please wait ${retryIn}s before asking for another code.`, retryIn };
  }
  const hourAgo = new Date(now - 3600_000);
  const [perTarget, perUser, perIp] = await Promise.all([
    prisma.otpCode.count({ where: { target, createdAt: { gte: hourAgo } } }),
    userId ? prisma.otpCode.count({ where: { userId, createdAt: { gte: hourAgo } } }) : Promise.resolve(0),
    ip ? prisma.otpCode.count({ where: { ip, createdAt: { gte: hourAgo } } }) : Promise.resolve(0),
  ]);
  if (perTarget >= CODES_PER_HOUR || perUser >= CODES_PER_HOUR || perIp >= 20) return { ok: false, error: "Too many codes requested. Try again in an hour." };

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
  await prisma.otpCode.updateMany({ where: { target, consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.otpCode.create({
    data: { channel, target, userId, codeHash: viaSupabase ? SUPABASE_MARK : viaTwilio ? TWILIO_MARK : hashCode(target, code), expiresAt: new Date(now + CODE_TTL_MS), ip },
  });
  return { ok: true, devCode };
}

/** Check the newest code for a target (5 tries, 10 minutes). Consumes it when right. */
async function checkCode(channel: Channel, target: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "Enter the 6-digit code." };
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
  return { ok: true };
}

export type RequestCodeResult =
  | { ok: true; channel: Channel; target: string; devCode?: string; isNew: boolean }
  | { ok: false; error: string; retryIn?: number; code?: "email_not_found" | "not_found" };

/** Mobile OTP login, for existing accounts (new accounts sign up with email + password). */
export async function requestCode(raw: string): Promise<RequestCodeResult> {
  const contact = parseContact(raw);
  if (!contact || contact.channel !== "phone") return { ok: false, error: "Enter your 10-digit mobile number." };
  const { channel, target } = contact;
  const existing = await prisma.user.findUnique({ where: { phone: target }, select: { id: true, phoneVerifiedAt: true } });
  if (!existing?.phoneVerifiedAt) return { ok: false, code: "not_found", error: "No account uses this mobile number. Sign up with your email and a password." };
  const r = await issueCode(channel, target, null);
  if (!r.ok) return r;
  return { ok: true, channel, target, devCode: r.devCode, isNew: false };
}

export type VerifyResult = { ok: true; user: CustomerUser; isNew: boolean } | { ok: false; error: string };

export async function verifyCode(raw: string, code: string): Promise<VerifyResult> {
  const contact = parseContact(raw);
  if (!contact || contact.channel !== "phone") return { ok: false, error: "Enter the 6-digit code." };
  const existing = await prisma.user.findUnique({ where: { phone: contact.target } });
  if (!existing?.phoneVerifiedAt) return { ok: false, error: "No account uses this mobile number. Sign up with your email and a password." };
  const c = await checkCode(contact.channel, contact.target, code);
  if (!c.ok) return c;
  await startSession(existing.id);
  return { ok: true, user: pick(existing), isNew: !existing.name };
}

/** Sign up with email + password. The mobile number is verified next, in the details step. */
export async function signUp(emailRaw: string, password: string): Promise<{ ok: true; user: CustomerUser } | { ok: false; error: string; field?: "email" | "password" }> {
  const email = emailRaw.trim().toLowerCase();
  const ip = await clientIp();
  const hourAgo = new Date(Date.now() - 3600_000);
  if ((await prisma.auditLog.count({ where: { action: "Customer signed up", by: `ip:${ip}`, at: { gte: hourAgo } } })) >= 10) {
    return { ok: false, error: "Too many new accounts from this network. Try again later." };
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, field: "email", error: "An account with this email already exists. Log in instead." };
  }
  const user = await prisma.user.create({ data: { email, name: "", passwordHash: await hashPassword(password) } });
  await prisma.auditLog.create({ data: { by: `ip:${ip}`, action: "Customer signed up", detail: "" } });
  await startSession(user.id);
  return { ok: true, user: pick(user) };
}

/** Send a code to verify a mobile number for the logged-in account. */
export async function sendPhoneCode(userId: string, phone: string): Promise<{ ok: true; devCode?: string; cooldown: number } | { ok: false; error: string; retryIn?: number }> {
  const owner = await prisma.user.findUnique({ where: { phone }, select: { id: true, phoneVerifiedAt: true } });
  if (owner && owner.id !== userId && owner.phoneVerifiedAt) return { ok: false, error: "This mobile number is already registered to another account." };
  const r = await issueCode("phone", phone, userId);
  if (!r.ok) return r;
  return { ok: true, devCode: r.devCode, cooldown: CODE_COOLDOWN_MS / 1000 };
}

/** Check the code and attach the verified mobile number to the logged-in account. */
export async function verifyPhoneCode(userId: string, phone: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const last = await prisma.otpCode.findFirst({ where: { target: phone, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!last || last.userId !== userId) return { ok: false, error: "Ask for a code first." };
  const c = await checkCode("phone", phone, code);
  if (!c.ok) return c;
  return prisma.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({ where: { phone }, select: { id: true, phoneVerifiedAt: true } });
    if (owner && owner.id !== userId) {
      if (owner.phoneVerifiedAt) return { ok: false as const, error: "This mobile number is already registered to another account." };
      await tx.user.update({ where: { id: owner.id }, data: { phone: null } }); // an unverified leftover
    }
    await tx.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: new Date() } });
    return { ok: true as const };
  });
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

function pick(u: { id: string; name: string; phone: string | null; email: string | null; phoneVerifiedAt: Date | null }): CustomerUser {
  return { id: u.id, name: u.name, phone: u.phone, email: u.email, phoneVerified: !!u.phoneVerifiedAt };
}

async function sessionId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  return id && sig && safeEqual(sig, sign(id)) ? id : null;
}

/** The logged-in customer, or null. */
/** The logged-in customer. Looked up once per request, however many components ask. */
export const getUser = cache(async (): Promise<CustomerUser | null> => {
  const id = await sessionId();
  if (!id) return null;
  const s = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return pick(s.user);
});

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
  jar.delete(MODE_COOKIE);
}

export type PasswordLogin = { ok: true; user: CustomerUser } | { ok: false; error: string };

/**
 * Email + password login. One message for an unknown email and a wrong
 * password (no telling which emails have accounts), and a lock after 5 wrong
 * tries for an email or 20 from one network in 15 minutes.
 */
export async function loginWithPassword(emailRaw: string, password: string): Promise<PasswordLogin> {
  const email = emailRaw.trim().toLowerCase();
  const ip = await clientIp();
  if (await customerLoginBlocked(email, ip)) return { ok: false, error: "Too many wrong tries. Wait 15 minutes, or log in with your mobile number." };
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok) {
    await recordCustomerFailure(email, ip);
    return { ok: false, error: user && !user.passwordHash ? "Email or password is wrong. If you never set a password, log in with your mobile number and set one in My profile." : "Email or password is wrong." };
  }
  await startSession(user.id);
  return { ok: true, user: pick(user) };
}

/**
 * Google said who this is (email verified by Google). Log into the account
 * with that Google id, or the one with that email (linking it), or create one.
 * The details step (name, verified mobile, password, address) still has to be finished.
 */
export async function signInWithGoogle(g: { sub: string; email: string; name: string }): Promise<{ ok: true; complete: boolean; rider: boolean } | { ok: false }> {
  let user = await prisma.user.findUnique({ where: { googleSub: g.sub } });
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: g.email } });
    user = byEmail
      ? await prisma.user.update({ where: { id: byEmail.id }, data: { googleSub: g.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(), ...(byEmail.name ? {} : { name: g.name }) } })
      : await prisma.user.create({ data: { email: g.email, googleSub: g.sub, emailVerifiedAt: new Date(), name: g.name } });
  }
  await startSession(user.id);
  const rider = !!user.phone && !!(await prisma.rider.findFirst({ where: { phone: user.phone, active: true }, select: { id: true } }));
  return { ok: true, complete: await isOnboarded(user.id), rider };
}
