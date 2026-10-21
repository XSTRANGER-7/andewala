import Link from "next/link";
import { Logo } from "@/components/art/Logo";
import { IconUser } from "@/components/ui/Icons";
import { CartButton } from "./CartButton";
import { LocationChip, type ChipAddress } from "./LocationChip";

type HeaderProps = { storeName: string; area: string; pincodes: string[]; activeOrders: number; addresses: ChipAddress[] | null };

export function Header({ storeName, area, pincodes, activeOrders, addresses }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-2 max-[379px]:h-14 max-[379px]:gap-1.5 sm:gap-6">
        <div className="shrink-0">
          <Logo name={storeName} />
        </div>
        {/* right side: delivery location (tap to change), then account and cart */}
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 max-[379px]:gap-1.5 sm:flex-none">
          <div className="min-w-0 sm:max-w-64">
            <LocationChip zone={area} pincodes={pincodes} addresses={addresses} />
          </div>
          <Link href="/account" className="hidden rounded-full p-2 text-ink-2 hover:bg-mint-100 hover:text-ink sm:inline-flex" aria-label="My account">
            <IconUser />
          </Link>
          <CartButton activeOrders={activeOrders} />
        </div>
      </div>
    </header>
  );
}
