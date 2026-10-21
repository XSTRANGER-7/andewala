import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/art/Logo";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdmin } from "@/server/session";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner sign in", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, admin, settings] = await Promise.all([searchParams, getAdmin(), getSettings()]);
  if (admin) redirect("/admin");
  return (
    <main className="grid min-h-screen place-items-center bg-mint-100 px-4 py-10">
      <div className="card w-full max-w-sm grid gap-6 shadow-float">
        <div className="grid gap-2">
          <Logo name={settings.storeName} />
          <h1 className="font-display text-2xl font-bold">Store admin</h1>
          <p className="text-sm text-ink-2">Sign in to manage price, stock, delivery windows and today&apos;s orders.</p>
        </div>
        <LoginForm next={next?.startsWith("/admin") ? next : "/admin"} />
      </div>
    </main>
  );
}
