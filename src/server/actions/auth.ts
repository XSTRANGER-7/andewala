"use server";

import { adminLoginBlocked, clientIp, recordAdminFailure } from "@/server/guard";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, createSessionToken, passwordMatches, sessionCookieOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";

export type LoginState = { error: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const next = String(formData.get("next") ?? "/admin");
  const ip = await clientIp();
  if (await adminLoginBlocked(ip)) {
    return { error: "Too many wrong passwords. Wait 15 minutes and try again." };
  }
  if (!passwordMatches(password)) {
    await recordAdminFailure(ip);
    return { error: "That password is wrong." };
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await createSessionToken("Owner"), sessionCookieOptions);
  await logAudit("Owner", "Signed in to admin");
  // Only ever back into admin (no open redirect to another site).
  redirect(/^\/admin(\/[\w\-\/]*)?$/.test(next) ? next : "/admin");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
