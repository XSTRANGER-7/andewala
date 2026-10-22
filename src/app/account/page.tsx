import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { LogoutButton } from "@/components/account/LogoutButton";
import { InstallAppButton } from "@/components/pwa/InstallPrompt";
import { SiteShell } from "@/components/layout/SiteShell";
import { IconArrow, IconPin, IconQuestion, IconTray, IconUser } from "@/components/ui/Icons";
import { StatusPill } from "@/components/ui/Pill";
import { inr } from "@/lib/money";
import { ACTIVE_STATUSES } from "@/lib/types";
import { requireAccount } from "@/server/account-page";
import { getRider } from "@/server/riders";
import { listCustomerOrders } from "@/server/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false } };

type Option = { href: string; label: string; sub: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; badge?: string };

/** The account menu: who you are, quick counts, and one row per section. */
export default async function AccountPage() {
  const [profile, rider] = await Promise.all([requireAccount("/account"), getRider()]);
  const orders = await listCustomerOrders(profile.id);
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const def = profile.addresses.find((a) => a.isDefault) ?? profile.addresses[0];
  const initials = profile.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const options: Option[] = [
    { href: "/account/profile", label: "My profile", sub: "Name, mobile number and email", Icon: IconUser },
    {
      href: "/orders",
      label: "My orders",
      sub: orders.length ? `${orders.length} order${orders.length === 1 ? "" : "s"} · track, cancel, reorder` : "Track, cancel and reorder",
      Icon: IconTray,
      badge: active.length ? `${active.length} active` : undefined,
    },
    {
      href: "/account/addresses",
      label: "Saved addresses",
      sub: def ? `${profile.addresses.length} saved · default: ${def.label}` : "Add a delivery address",
      Icon: IconPin,
    },
    { href: "/account/help", label: "Help and support", sub: "FAQs, broken eggs, call or email us", Icon: IconQuestion },
  ];

  return (
    <SiteShell>
      <div className="container-x grid max-w-3xl gap-4 py-5 sm:gap-5 sm:py-8">
        <section className="card flex items-center gap-4 bg-mint-50">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-forest-900 font-display text-lg font-bold text-white" aria-hidden="true">
            {initials || "?"}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{profile.name}</h1>
            <p className="num truncate text-sm text-ink-2">+91 {profile.phone}</p>
            <p className="truncate text-xs text-ink-3">{profile.email}</p>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { n: active.length, l: "On the way" },
            { n: orders.length, l: "Orders" },
            { n: profile.addresses.length, l: "Addresses" },
          ].map((s) => (
            <div key={s.l} className="rounded-[var(--radius-card)] border border-line bg-paper p-3 text-center">
              <div className="num font-display text-2xl font-bold text-sage-600">{s.n}</div>
              <div className="text-xs text-ink-2">{s.l}</div>
            </div>
          ))}
        </div>

        {active[0] && (
          <Link href={`/order/${active[0].id}`} className="card flex items-center justify-between gap-3 border-forest-900/30 transition hover:border-ink-3">
            <div className="min-w-0">
              <p className="eyebrow">On the way</p>
              <p className="num truncate font-bold">{active[0].id}</p>
              <p className="text-xs text-ink-2">
                {active[0].trays} tray{active[0].trays > 1 ? "s" : ""} · {inr(active[0].total)} · {active[0].slotLabel}
              </p>
            </div>
            <StatusPill status={active[0].status} customer />
          </Link>
        )}

        <InstallAppButton className="card flex items-center justify-center gap-2 border-dashed border-forest-900/40 bg-mint-50 py-3.5 text-sm font-bold text-forest-900 transition hover:border-forest-900" />

        {rider && (
          <Link href="/rider" className="card flex items-center justify-between gap-3 border-2 border-forest-900 bg-forest-900 text-white transition hover:bg-forest-800">
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wide text-white/70">Delivery partner</span>
              <span className="font-display text-lg font-bold">Open my deliveries</span>
            </span>
            <span aria-hidden="true" className="text-2xl">→</span>
          </Link>
        )}

        <nav className="grid gap-2" aria-label="Account sections">
          {options.map(({ href, label, sub, Icon, badge }) => (
            <Link key={href} href={href} className="card flex items-center gap-4 py-4 transition hover:border-ink-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint-100 text-forest-900">
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  {label}
                  {badge && <span className="rounded-full bg-yolk-soft px-2 py-0.5 text-[11px] font-bold text-yolk-ink">{badge}</span>}
                </span>
                <span className="block truncate text-xs text-ink-2">{sub}</span>
              </span>
              <IconArrow className="shrink-0 text-ink-3" />
            </Link>
          ))}
          <LogoutButton />
        </nav>
      </div>
    </SiteShell>
  );
}
