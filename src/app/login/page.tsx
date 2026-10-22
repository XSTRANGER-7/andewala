import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/account/LoginForm";
import { SiteShell } from "@/components/layout/SiteShell";
import { getProfile, profileComplete } from "@/server/accounts";
import { getUser } from "@/server/customer-auth";
import { getSettings } from "@/server/settings";
import { getActiveZones } from "@/server/zones";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in", robots: { index: false } };

/** Only same-site paths are allowed as a destination after login. */
function safeNext(raw: string | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/account";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, user] = await Promise.all([searchParams, getUser()]);
  const dest = safeNext(next);
  const profile = user ? await getProfile(user.id) : null;
  if (profile && profileComplete(profile)) redirect(dest);
  // Logged in but the profile was never finished: pick up at the details step.
  const resumeProfile = profile ? { name: profile.name, email: profile.email, hasAddress: profile.addresses.length > 0, hasPassword: profile.hasPassword } : undefined;
  const [{ pincodes }, zones] = await Promise.all([getSettings(), getActiveZones()]);
  return (
    <SiteShell>
      <div className="container-x grid max-w-md gap-5 py-8 sm:py-12">
        <header className="grid gap-1">
          <p className="eyebrow">Account</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{dest === "/cart" ? "Log in to place your order" : "Log in or sign up"}</h1>
          <p className="text-sm text-ink-2">Enter your mobile number to log in or create an account.</p>
        </header>
        <div className="card">
          <LoginForm next={dest} coverage={{ zones, pincodes }} resumeProfile={resumeProfile} />
        </div>
        <p className="text-center text-xs text-ink-3">Your cart stays saved while you log in.</p>
      </div>
    </SiteShell>
  );
}
