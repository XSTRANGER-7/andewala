import Link from "next/link";
import { Logo } from "@/components/art/Logo";
import { IconFacebook, IconInstagram, IconMail, IconPhone, IconPin, IconWhatsapp } from "@/components/ui/Icons";
import type { StoreSettings } from "@/lib/types";
import { fmtTime } from "@/lib/time";

export function Footer({ settings }: { settings: StoreSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-mint-50">
      <div className="container-x grid gap-6 py-8 sm:grid-cols-2 sm:gap-8 sm:py-10 lg:grid-cols-4">
        <div className="grid content-start gap-4">
          <Logo name={settings.storeName} />
          <p className="max-w-xs text-sm text-ink-2">Fresh 30-egg trays at today&apos;s farm price, delivered to your door by {fmtTime(settings.deadline)}.</p>
          <div className="flex gap-3 text-forest-900">
            <a href="#" aria-label="Instagram" className="rounded-full p-1.5 hover:bg-mint-200">
              <IconInstagram />
            </a>
            <a href="#" aria-label="Facebook" className="rounded-full p-1.5 hover:bg-mint-200">
              <IconFacebook />
            </a>
            <a href="#" aria-label="WhatsApp" className="rounded-full p-1.5 hover:bg-mint-200">
              <IconWhatsapp />
            </a>
          </div>
        </div>
        <div>
          <h4 className="eyebrow mb-3">Shop</h4>
          <ul className="grid gap-2 text-sm text-ink-2">
            <li>
              <Link href="/cart" className="hover:text-ink">
                Order a tray
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-ink">
                Track your order
              </Link>
            </li>
            <li>
              <Link href="/#why" className="hover:text-ink">
                Why {settings.storeName}
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="hover:text-ink">
                FAQ
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="eyebrow mb-3">Contact</h4>
          <ul className="grid gap-2.5 text-sm text-ink-2">
            <li className="flex items-start gap-2">
              <IconPin className="mt-0.5 shrink-0 text-forest-900" />
              <span>Delivering across {settings.pincodes.length ? settings.pincodes.join(", ") : settings.areaName}</span>
            </li>
            {settings.supportPhone && (
              <li className="flex items-center gap-2">
                <IconPhone className="shrink-0 text-forest-900" />
                <a href={`tel:${settings.supportPhone}`} className="hover:text-ink">
                  {settings.supportPhone}
                </a>
              </li>
            )}
            <li className="flex items-center gap-2">
              <IconMail className="shrink-0 text-forest-900" />
              <a href="mailto:hello@andewala.in" className="hover:text-ink">
                hello@andewala.in
              </a>
            </li>
          </ul>
        </div>
        <div className="hidden sm:block">
          <h4 className="eyebrow mb-3">Hours</h4>
          <ul className="grid gap-2 text-sm text-ink-2">
            <li>Same-day orders until {fmtTime(settings.cutoff)}</li>
            <li>Deliveries {settings.slots.map((s) => s.label).join(" and ")}</li>
            <li>Book up to {settings.daysAhead} days ahead</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col gap-2 py-4 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {settings.storeName}. All prices in ₹, times in IST.
          </span>
          <Link href="/admin/login" className="hover:text-ink">
            Owner sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
