import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "./auth";
import { getUser } from "./customer-auth";

/** The signed-in admin, or null. */
export async function getAdmin(): Promise<{ name: string } | null> {
  const jar = await cookies();
  const payload = await verifySessionToken(jar.get(ADMIN_COOKIE)?.value);
  return payload ? { name: payload.name } : null;
}

/** Throws unless an admin session is present. Use at the top of every admin action. */
export async function requireAdmin(): Promise<{ name: string }> {
  const admin = await getAdmin();
  if (!admin) throw new Error("Not signed in.");
  return admin;
}

/**
 * The id orders are filed under: the logged-in customer's user id, or null
 * when nobody is logged in. Orders can only be placed while logged in.
 */
export async function getCustomerId(): Promise<string | null> {
  return (await getUser())?.id ?? null;
}
