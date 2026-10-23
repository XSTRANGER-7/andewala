import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/account/LoginForm";
import { SiteShell } from "@/components/layout/SiteShell";
import { cn } from "@/lib/cn";
import { getProfile, profileComplete } from "@/server/accounts";
import { getUser } from "@/server/customer-auth";
import { getSettings } from "@/server/settings";
import { getActiveZones } from "@/server/zones";
import { googleEnabled } from "@/server/google";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in", robots: { index: false } };

/** Only same-site paths are allowed as a destination after login. */
function safeNext(raw: string | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/account";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; google?: string }> }) {
  const [{ next, google: googleError }, user] = await Promise.all([searchParams, getUser()]);
  const dest = safeNext(next);
  const profile = user ? await getProfile(user.id) : null;
  // Existing customers go straight in. The only thing they can be stopped for is
  // ordering without a verified mobile number.
  const verifyToOrder = !!profile?.onboarded && dest.startsWith("/cart") && !profileComplete(profile);
  if (profile?.onboarded && !verifyToOrder) redirect(dest);
  // New account: the one-time "Finish your account" step.
  const resumeProfile = profile
    ? {
        name: profile.name,
        email: profile.email,
        hasAddress: profile.addresses.length > 0,
        hasPassword: profile.hasPassword || verifyToOrder,
        phone: profile.phone,
        phoneVerified: profile.phoneVerified,
        mode: verifyToOrder ? ("verify" as const) : ("finish" as const),
      }
    : undefined;
  const [{ pincodes }, zones] = await Promise.all([getSettings(), getActiveZones()]);
  const title = !resumeProfile ? "Log in to your account" : verifyToOrder ? "Verify your mobile to order" : "Finish your account";
  const sub = !resumeProfile
    ? "With your email and password, or your Google account. New here? The same form creates your account."
    : verifyToOrder
      ? "The rider calls this number when they reach you. You only do this once."
      : "A few details, one time only: your name, a verified mobile number, a password and your delivery address.";
  return (
    <SiteShell>
      <div className={cn("container-x grid gap-5 py-6 sm:py-12", resumeProfile && !verifyToOrder ? "max-w-2xl" : "max-w-md")}>
        <header className="grid gap-1">
          <p className="eyebrow">Account</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="text-sm text-ink-2">{sub}</p>
        </header>
        <div className="card">
          <LoginForm key={resumeProfile ? "details" : "auth"} next={dest} coverage={{ zones, pincodes }} resumeProfile={resumeProfile} google={googleEnabled()} googleError={googleError} />
        </div>
        {!resumeProfile && <p className="text-center text-xs text-ink-3">Your cart stays saved while you log in.</p>}
      </div>
    </SiteShell>
  );
}
