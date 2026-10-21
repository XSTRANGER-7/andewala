import type { Metadata } from "next";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AddressBook } from "@/components/account/AddressBook";
import { SiteShell } from "@/components/layout/SiteShell";
import { requireAccount } from "@/server/account-page";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved addresses", robots: { index: false } };

export default async function AddressesPage() {
  const [profile, settings] = await Promise.all([requireAccount("/account/addresses"), getSettings()]);
  return (
    <SiteShell>
      <div className="container-x grid max-w-3xl gap-4 py-5 sm:gap-5 sm:py-8">
        <AccountPageHeader title="Saved addresses" sub={`Up to 10 addresses. Your default is used at checkout and shown at the top of every page. ${profile.addresses.length} of 10 saved.`} />
        <section className="card">
          <AddressBook addresses={profile.addresses} pincodes={settings.pincodes} defaults={{ name: profile.name, phone: profile.phone ?? "" }} />
        </section>
      </div>
    </SiteShell>
  );
}
