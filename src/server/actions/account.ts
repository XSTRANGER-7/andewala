"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { endSession, requestCode, requireUser, verifyCode } from "@/server/customer-auth";
import * as accounts from "@/server/accounts";
import { addressSchema, fieldErrors, profileSchema, signupSchema, type AddressInput, type SignupInput } from "@/lib/validation";
import { getActiveZones } from "@/server/zones";
import { isCovered } from "@/lib/zones";
import { getSettings } from "@/server/settings";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

function refresh() {
  for (const p of ["/", "/cart", "/account", "/orders"]) revalidatePath(p);
}

export async function requestCodeAction(contact: string): Promise<Result<{ channel: "phone" | "email"; target: string; devCode?: string; isNew: boolean }>> {
  const res = await requestCode(contact);
  if (!res.ok) return { ok: false, errors: res.code === "email_not_found" ? { contact: res.error, emailNotFound: "1" } : { contact: res.error } };
  return { ok: true, data: { channel: res.channel, target: res.target, devCode: res.devCode, isNew: res.isNew } };
}

export async function verifyCodeAction(contact: string, code: string): Promise<Result<{ isNew: boolean; complete: boolean; rider: boolean }>> {
  const res = await verifyCode(contact, code);
  if (!res.ok) return { ok: false, errors: { code: res.error } };
  refresh();
  const rider = !!res.user.phone && !!(await prisma.rider.findFirst({ where: { phone: res.user.phone, active: true }, select: { id: true } }));
  return { ok: true, data: { isNew: res.isNew, complete: accounts.profileComplete(res.user) || rider, rider } };
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
    if (!me.phone) return { ok: false, errors: { form: "Sign up with your mobile number first." } };
    const { name, email, label, address, landmark, pincode, lat, lng } = parsed.data;
    const [settings, zones] = await Promise.all([getSettings(), getActiveZones()]);
    if (isCovered({ zones, pincodes: settings.pincodes }, { lat, lng, pincode }) === false) {
      return { ok: false, errors: zones.length ? { pin: "This pin is outside our delivery area. Move it inside the shaded area on the map." } : { pincode: `We don't deliver to ${pincode} yet.` } };
    }
    if (await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } })) {
      return { ok: false, errors: { email: "This email already has an account. Log in with it instead." } };
    }
    await prisma.user.update({ where: { id: user.id }, data: { name, ...(me.emailVerifiedAt ? {} : { email }) } });
    const hasAddress = (await accounts.listAddresses(user.id)).length > 0;
    if (!hasAddress) await accounts.saveAddress(user.id, { label, name, phone: me.phone, address, landmark, pincode, lat, lng }, { makeDefault: true });
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

    if (!current.phoneVerifiedAt && parsed.data.phone !== undefined) {
      const phone = parsed.data.phone || null;
      if (phone && (await prisma.user.findFirst({ where: { phone, NOT: { id: user.id } } }))) {
        return { ok: false, errors: { phone: "This mobile number already has an account. Log in with it instead." } };
      }
      data.phone = phone;
    }
    if (!current.emailVerifiedAt && parsed.data.email !== undefined) {
      const email = parsed.data.email || null;
      if (email && (await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } }))) {
        return { ok: false, errors: { email: "This email already has an account. Log in with it instead." } };
      }
      data.email = email;
    }
    if (!(data.phone ?? current.phone)) return { ok: false, errors: { phone: "Add a mobile number so the rider can reach you." } };
    if (!(data.email ?? current.email)) return { ok: false, errors: { email: "Add your email address." } };

    await prisma.user.update({ where: { id: user.id }, data });
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
