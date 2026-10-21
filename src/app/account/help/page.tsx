import type { Metadata } from "next";
import Link from "next/link";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { SiteShell } from "@/components/layout/SiteShell";
import { IconMail, IconPhone, IconWhatsapp } from "@/components/ui/Icons";
import { FAQ } from "@/content/site";
import { fmtTime } from "@/lib/time";
import { requireAccount } from "@/server/account-page";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Help and support", robots: { index: false } };

export default async function HelpPage() {
  const [, settings] = await Promise.all([requireAccount("/account/help"), getSettings()]);
  const phone = settings.supportPhone.replace(/\D/g, "");
  return (
    <SiteShell>
      <div className="container-x grid max-w-3xl gap-4 py-5 sm:gap-5 sm:py-8">
        <AccountPageHeader title="Help and support" sub={`We deliver until ${fmtTime(settings.deadline)}. Problems with a delivered order? Report them from the order page.`} />

        <section className="card grid gap-3">
          <h2 className="font-display text-lg font-bold">Contact us</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {phone && (
              <a href={`tel:${settings.supportPhone}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-3 text-sm font-semibold text-forest-900 hover:bg-mint-50">
                <IconPhone /> Call us
              </a>
            )}
            {phone && (
              <a href={`https://wa.me/${phone.length === 10 ? "91" + phone : phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-line px-3 py-3 text-sm font-semibold text-forest-900 hover:bg-mint-50">
                <IconWhatsapp /> WhatsApp
              </a>
            )}
            <a href="mailto:hello@andewala.in" className="flex items-center gap-2 rounded-lg border border-line px-3 py-3 text-sm font-semibold text-forest-900 hover:bg-mint-50">
              <IconMail /> Email us
            </a>
          </div>
          <p className="text-xs text-ink-3">
            Broken or missing eggs? Open the order in{" "}
            <Link href="/orders" className="font-semibold text-forest-900 hover:underline">
              My orders
            </Link>{" "}
            and tap Report broken or missing eggs.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-lg font-bold">Common questions</h2>
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-[var(--radius-card)] border border-line bg-paper px-4 py-3 open:shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold marker:content-none">
                {f.q}
                <span className="text-lg leading-none text-sage-600 transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-ink-2">{f.a}</p>
            </details>
          ))}
        </section>
      </div>
    </SiteShell>
  );
}
