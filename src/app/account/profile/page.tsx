import type { Metadata } from "next";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { ProfileCard } from "@/components/account/ProfileCard";
import { SiteShell } from "@/components/layout/SiteShell";
import { requireAccount } from "@/server/account-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My profile", robots: { index: false } };

export default async function ProfilePage() {
  const profile = await requireAccount("/account/profile");
  return (
    <SiteShell>
      <div className="container-x grid max-w-3xl gap-4 py-5 sm:gap-5 sm:py-8">
        <AccountPageHeader title="My profile" sub="The contact you sign up or log in with is verified. You can log in with your mobile number or your email." />
        <section className="card">
          <ProfileCard profile={profile} />
        </section>
      </div>
    </SiteShell>
  );
}
