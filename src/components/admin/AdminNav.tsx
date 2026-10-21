"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/pricing", label: "Price & stock" },
  { href: "/admin/settings", label: "Delivery settings" },
  { href: "/admin/activity", label: "Activity" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-3 flex gap-1 overflow-x-auto border-b border-line px-3 pb-2 sm:mx-0 sm:px-0" aria-label="Admin sections">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition", active ? "bg-paper text-ink shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:bg-mint-100 hover:text-ink")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
