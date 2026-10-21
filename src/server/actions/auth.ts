"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, createSessionToken, passwordMatches, sessionCookieOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";

export type LoginState = { error: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!passwordMatches(password)) {
    return { error: "That password is wrong." };
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await createSessionToken("Owner"), sessionCookieOptions);
  await logAudit("Owner", "Signed in to admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
