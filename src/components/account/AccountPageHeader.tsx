import Link from "next/link";

/** Title block for the pages under My account, with a way back to the menu. */
export function AccountPageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="grid gap-1">
      <Link href="/account" className="w-max text-xs font-semibold text-forest-900 hover:underline">
        ← My account
      </Link>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
      {sub && <p className="text-sm text-ink-2">{sub}</p>}
    </header>
  );
}
