"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { endSession, requireUser, sendPhoneCode, signUp, verifyPhoneCode } from "@/server/customer-auth";
import * as accounts from "@/server/accounts";
import { addressSchema, fieldErrors, profileSchema, signupSchema, type AddressInput, type SignupInput } from "@/lib/validation";
import { getActiveZones } from "@/server/zones";
import { isCovered } from "@/lib/zones";
import { getSettings } from "@/server/settings";
import { hashPassword, verifyPassword } from "@/server/password";
import { clientIp, customerLoginBlocked, recordCustomerFailure } from "@/server/guard";
import { loginWithPassword } from "@/server/customer-auth";
import { emailSchema, passwordSchema, phoneSchema } from "@/lib/validation";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

function refresh() {
  for (const p of ["/", "/cart", "/account", "/orders"]) revalidatePath(p);
}

export async function logoutCustomerAction(): Promise<void> {
  await endSession();
  refresh();
}

/**
 * Finish sign-up after the first mobile login: name, email and the first
 * delivery address, saved together. The verified mobile is the address's phone.
 */
export async function completeSignupAction(input: SignupInput): Promise<Result> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const user = await requireUser();
    const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!me.phone || !me.phoneVerifiedAt) return { ok: false, errors: { phone: "Verify your mobile number to continue." } };
    if (!me.passwordHash && !parsed.data.password) return { ok: false, errors: { password: "Choose a password." } };
    const { name, email, label, address, landmark, pincode, lat, lng, password } = parsed.data;
    const [settings, zones] = await Promise.all([getSettings(), getActiveZones()]);
    if (isCovered({ zones, pincodes: settings.pincodes }, { lat, lng, pincode }) === false) {
      return { ok: false, errors: zones.length ? { pin: "This pin is outside our delivery area. Move it inside the shaded area on the map." } : { pincode: `We don't deliver to ${pincode} yet.` } };
    }
    if (await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } })) {
      return { ok: false, errors: { email: "This email already has an account. Log in with it instead." } };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { name, ...(me.emailVerifiedAt || me.email ? {} : { email }), ...(password && !me.passwordHash ? { passwordHash: await hashPassword(password) } : {}) },
    });
    const hasAddress = (await accounts.listAddresses(user.id)).length > 0;
    if (!hasAddress) await accounts.saveAddress(user.id, { label, name, phone: me.phone, address, landmark, pincode, lat, lng }, { makeDefault: true });
    await accounts.markOnboardedIfReady(user.id);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, errors: { form: e instanceof Error ? e.message : "That didn't save. Try again." } };
  }
}

/** Save name and the second contact. The contact used to log in is verified and can't be changed here. */
export async function saveProfileAction(input: { name: string; phone?: string; email?: string }): Promise<Result> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const user = await requireUser();
    const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const data: { name: string; phone?: string | null; email?: string | null } = { name: parsed.data.name };

    // The mobile number is only ever set by verifying it with a code (sendPhoneCodeAction / verifyPhoneCodeAction).
    if (!current.emailVerifiedAt && parsed.data.email !== undefined) {
      const email = parsed.data.email || null;
      if (email && (await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } }))) {
        return { ok: false, errors: { email: "This email already has an account. Log in with it instead." } };
      }
      data.email = email;
    }
    if (!current.phone || !current.phoneVerifiedAt) return { ok: false, errors: { phone: "Verify your mobile number to continue." } };
    if (!(data.email ?? current.email)) return { ok: false, errors: { email: "Add your email address." } };

    await prisma.user.update({ where: { id: user.id }, data });
    await accounts.markOnboardedIfReady(user.id);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, errors: { form: e instanceof Error ? e.message : "That didn't save. Try again." } };
  }
}

export async function saveAddressAction(input: AddressInput, opts: { id?: string; makeDefault?: boolean } = {}): Promise<Result<accounts.AddressView>> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const user = await requireUser();
    if (opts.id && !(await accounts.getAddress(user.id, opts.id))) return { ok: false, errors: { form: "That address no longer exists." } };
    if (!opts.id && (await accounts.listAddresses(user.id)).length >= 10) return { ok: false, errors: { form: "You can save up to 10 addresses. Remove one first." } };
    const [settings, zones] = await Promise.all([getSettings(), getActiveZones()]);
    if (isCovered({ zones, pincodes: settings.pincodes }, parsed.data) === false) {
      return { ok: false, errors: zones.length ? { pin: "This pin is outside our delivery area. Move it inside the shaded area on the map." } : { pincode: `We don't deliver to ${parsed.data.pincode} yet.` } };
    }
    const saved = await accounts.saveAddress(user.id, parsed.data, opts);
    refresh();
    return { ok: true, data: saved };
  } catch (e) {
    return { ok: false, errors: { form: e instanceof Error ? e.message : "That didn't save. Try again." } };
  }
}

export async function setDefaultAddressAction(id: string): Promise<Result> {
  try {
    const user = await requireUser();
    await accounts.setDefaultAddress(user.id, id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, errors: { form: "That address no longer exists." } };
  }
}

export async function deleteAddressAction(id: string): Promise<Result> {
  try {
    const user = await requireUser();
    await accounts.deleteAddress(user.id, id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, errors: { form: "That address no longer exists." } };
  }
}

/** Email + password login (for accounts that have set a password). */
export async function passwordLoginAction(email: string, password: string): Promise<Result<{ complete: boolean; rider: boolean }>> {
  if (typeof email !== "string" || typeof password !== "string" || email.length > 200 || password.length > 200) return { ok: false, errors: { password: "Email or password is wrong." } };
  if (!emailSchema.safeParse(email).success) return { ok: false, errors: { email: "Enter a valid email address." } };
  const res = await loginWithPassword(email, password);
  if (!res.ok) return { ok: false, errors: { password: res.error } };
  refresh();
  const rider = !!res.user.phone && !!(await prisma.rider.findFirst({ where: { phone: res.user.phone, active: true }, select: { id: true } }));
  return { ok: true, data: { complete: (await accounts.isOnboarded(res.user.id)) || rider, rider } };
}

/**
 * Set or change the password from My profile. Changing needs the current
 * password; setting the first one only needs the login (mobile OTP).
 */
export async function setPasswordAction(input: { current?: string; password: string }): Promise<Result> {
  const parsed = passwordSchema.safeParse(input?.password);
  if (!parsed.success) return { ok: false, errors: { password: parsed.error.issues[0]?.message ?? "Choose a stronger password." } };
  try {
    const user = await requireUser();
    const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (me.passwordHash) {
      const ip = await clientIp();
      const key = me.email ?? me.id;
      if (await customerLoginBlocked(key, ip)) return { ok: false, errors: { current: "Too many wrong tries. Wait 15 minutes." } };
      if (!(await verifyPassword(String(input.current ?? "").slice(0, 200), me.passwordHash))) {
        await recordCustomerFailure(key, ip);
        return { ok: false, errors: { current: "Your current password isn't right." } };
      }
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data) } });
    await accounts.markOnboardedIfReady(user.id);
    // Other devices stay logged in with their own sessions; this one keeps working.
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, errors: { form: e instanceof Error ? e.message : "That didn't save. Try again." } };
  }
}

/**
 * The one login form. A known email logs in. An unknown email asks to confirm
 * the password once (`confirm`), then creates the account and goes to "Finish your account".
 */
export async function continueWithEmailAction(email: string, password: string, confirm?: string): Promise<Result<{ complete: boolean; rider: boolean; created: boolean }>> {
  if (typeof email !== "string" || typeof password !== "string" || email.length > 200 || password.length > 200) return { ok: false, errors: { password: "Email or password is wrong." } };
  const e = emailSchema.safeParse(email.trim().toLowerCase());
  if (!e.success) return { ok: false, errors: { email: "Enter a valid email address." } };
  const existing = await prisma.user.findUnique({ where: { email: e.data }, select: { passwordHash: true, googleSub: true } });
  if (existing) {
    if (!existing.passwordHash && existing.googleSub) return { ok: false, errors: { password: "This account signs in with Google. Use Continue with Google." } };
    const r = await passwordLoginAction(e.data, password);
    return r.ok ? { ok: true, data: { ...r.data, created: false } } : r;
  }
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { ok: false, errors: { newAccount: "1", password: pw.error.issues[0]?.message ?? "Choose a stronger password." } };
  if (typeof confirm !== "string") return { ok: false, errors: { newAccount: "1" } };
  if (confirm !== password) return { ok: false, errors: { newAccount: "1", password2: "The two passwords don't match." } };
  const r = await signUp(e.data, pw.data);
  if (!r.ok) return { ok: false, errors: { [r.field ?? "form"]: r.error } };
  refresh();
  return { ok: true, data: { complete: false, rider: false, created: true } };
}

/** Send a verification code to a mobile number for the logged-in account. */
export async function sendPhoneCodeAction(phone: string): Promise<Result<{ devCode?: string; cooldown: number }> & { retryIn?: number }> {
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) return { ok: false, errors: { phone: "Enter a 10-digit mobile number." } };
  try {
    const user = await requireUser();
    const r = await sendPhoneCode(user.id, parsed.data);
    if (!r.ok) return { ok: false, errors: { phone: r.error }, retryIn: r.retryIn };
    return { ok: true, data: { devCode: r.devCode, cooldown: r.cooldown } };
  } catch {
    return { ok: false, errors: { phone: "Log in again to verify your number." } };
  }
}

/** Check the code and save the verified mobile number on the account. */
export async function verifyPhoneCodeAction(phone: string, code: string, opts: { stay?: boolean } = {}): Promise<Result> {
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success || typeof code !== "string") return { ok: false, errors: { code: "Enter the 6-digit code." } };
  try {
    const user = await requireUser();
    const r = await verifyPhoneCode(user.id, parsed.data, code.slice(0, 10));
    if (!r.ok) return { ok: false, errors: { code: r.error } };
    // During sign-up the form stays put (shows "Verified") until the rest is filled in.
    if (!opts.stay) refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, errors: { code: "Log in again to verify your number." } };
  }
}
