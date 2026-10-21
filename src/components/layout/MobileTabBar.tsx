"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useCartDraft } from "@/lib/cart";
import { IconHome, IconTray, IconUser } from "@/components/ui/Icons";

const TABS = [
  { href: "/", label: "Home", Icon: IconHome, active: (p: string) => p === "/" },
  { href: "/orders", label: "My orders", Icon: IconTray, active: (p: string) => p === "/orders" || p.startsWith("/order/") },
  { href: "/account", label: "My account", Icon: IconUser, active: (p: string) => p.startsWith("/account") || p.startsWith("/admin") },
];

/** Fixed bottom navigation on phones. Hidden while checking out in the cart, where the order total bar takes its place. */
export function MobileTabBar() {
  const pathname = usePathname();
  const draft = useCartDraft();
  if (pathname === "/cart" && draft) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Quick navigation"
    >
      {TABS.map(({ href, label, Icon, active }) => {
        const on = active(pathname);
        return (
          <Link
            key={label}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition", on ? "text-forest-900" : "text-ink-3 hover:text-ink")}
          >
            <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", on && "bg-mint-100")}>
              <Icon width={21} height={21} strokeWidth={on ? 2 : 1.7} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
