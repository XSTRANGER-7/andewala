import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/account/LoginForm";
import { SiteShell } from "@/components/layout/SiteShell";
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
        emailVerified: profile.emailVerified,
        mode: verifyToOrder ? ("verify" as const) : ("finish" as const),
      }
    : undefined;
  const [{ pincodes }, zones] = await Promise.all([getSettings(), getActiveZones()]);
  const form = <LoginForm key={resumeProfile ? "details" : "auth"} next={dest} coverage={{ zones, pincodes }} resumeProfile={resumeProfile} google={googleEnabled()} googleError={googleError} />;
  return (
    <SiteShell>
      {resumeProfile ? (
        // "Finish your account" / "Verify your mobile to order" draw their own header and sections.
        <div className="container-x flex max-w-xl flex-col py-5 sm:py-10">{form}</div>
      ) : (
        <div className="container-x flex max-w-md flex-col gap-5 py-6 sm:py-12">
          <header className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Log in to your account</h1>
            <p className="text-sm text-ink-2">New here? The same form creates your account.</p>
          </header>
          <div className="card min-w-0">{form}</div>
          <p className="text-center text-xs text-ink-3">Your cart stays saved while you log in.</p>
        </div>
      )}
    </SiteShell>
  );
}
