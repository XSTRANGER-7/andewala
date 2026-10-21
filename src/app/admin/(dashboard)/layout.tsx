import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/art/Logo";
import { AdminNav } from "@/components/admin/AdminNav";
import { StoreControls } from "@/components/admin/StoreControls";
import { IconLogout } from "@/components/ui/Icons";
import { logoutAction } from "@/server/actions/auth";
import { getAdmin } from "@/server/session";
import { getAvailability } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { fmtTime } from "@/lib/time";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [admin, settings, availability] = await Promise.all([getAdmin(), getSettings(), getAvailability()]);
  if (!admin) redirect("/admin/login");
  return (
    <div className="min-h-screen bg-mint-50">
      <header className="border-b border-line bg-paper">
        <div className="container-x flex h-14 items-center gap-4">
          <Logo name={settings.storeName} href="/admin" />
          <span className="hidden text-sm text-ink-3 sm:inline">Store admin</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="hidden text-sm font-semibold text-ink-2 hover:text-ink sm:inline">
              View store
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-2 hover:bg-mint-100 hover:text-ink" aria-label="Sign out">
                <IconLogout width={18} height={18} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="container-x grid gap-6 py-6">
        <StoreControls mode={settings.storeMode} outOfStock={settings.outOfStock} hours={`${fmtTime(settings.openTime)} to ${fmtTime(settings.cutoff)}`} status={availability.status} />
        <AdminNav />
        {children}
      </div>
    </div>
  );
}
