import "server-only";
import { prisma, TX_OPTIONS } from "./db";

export type AddressView = {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  landmark: string;
  pincode: string;
  /** Map pin, or null for an address saved before pins existed. */
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
};
export type Profile = { id: string; name: string; phone: string | null; email: string | null; phoneVerified: boolean; emailVerified: boolean; hasPassword: boolean; addresses: AddressView[] };

const toView = (a: AddressView): AddressView => ({
  id: a.id,
  label: a.label,
  name: a.name,
  phone: a.phone,
  address: a.address,
  landmark: a.landmark,
  pincode: a.pincode,
  lat: a.lat ?? null,
  lng: a.lng ?? null,
  isDefault: a.isDefault,
});

export async function getProfile(userId: string): Promise<Profile | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { addresses: { orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] } } });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    phoneVerified: !!u.phoneVerifiedAt,
    emailVerified: !!u.emailVerifiedAt,
    hasPassword: !!u.passwordHash,
    addresses: u.addresses.map(toView),
  };
}

/** A profile is complete once it has a name, a mobile number for the rider, and an email. */
export function profileComplete(p: Pick<Profile, "name" | "phone" | "email">): boolean {
  return p.name.trim().length >= 2 && !!p.phone && !!p.email;
}

export async function listAddresses(userId: string): Promise<AddressView[]> {
  const rows = await prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
  return rows.map(toView);
}

export async function getAddress(userId: string, id: string): Promise<AddressView | null> {
  const a = await prisma.address.findFirst({ where: { id, userId } });
  return a ? toView(a) : null;
}

type AddressInput = { label: string; name: string; phone: string; address: string; landmark: string; pincode: string; lat?: number | null; lng?: number | null };

/** Create or update an address. The first address, or one marked default, becomes the default. */
export async function saveAddress(userId: string, input: AddressInput, opts: { id?: string; makeDefault?: boolean } = {}): Promise<AddressView> {
  return prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    const makeDefault = !!opts.makeDefault || count === 0;
    if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    const row = opts.id
      ? await tx.address.update({ where: { id: opts.id, userId }, data: { ...input, ...(makeDefault ? { isDefault: true } : {}) } })
      : await tx.address.create({ data: { ...input, userId, isDefault: makeDefault } });
    return toView(row);
  }, TX_OPTIONS);
}

export async function setDefaultAddress(userId: string, id: string): Promise<void> {
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id, userId }, data: { isDefault: true } }),
  ]);
}

/** Delete an address; if it was the default, the most recent remaining one takes over. */
export async function deleteAddress(userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const gone = await tx.address.delete({ where: { id, userId } });
    if (gone.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }, TX_OPTIONS);
}
