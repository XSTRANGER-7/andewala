import { Logo } from "@/components/art/Logo";
import { MobileTabBar } from "./MobileTabBar";

/**
 * Shown instantly while a page loads on the server: the same header and tab
 * bar as the real page, with a soft placeholder for the content. It reads no
 * data, so Next.js can prefetch it and show it the moment a link is tapped.
 */
export function ShellSkeleton() {
  return (
    <>
      <div className="h-9 bg-forest-900" aria-hidden="true" />
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
        <div className="container-x flex h-16 items-center gap-2 max-[379px]:h-14">
          <Logo name="AndeWala" />
          <div className="ml-auto flex items-center gap-2">
            <div className="h-9 w-28 animate-pulse rounded-full bg-mint-100 sm:w-44" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-mint-100" />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-14 lg:pb-0" aria-busy="true" aria-label="Loading">
        <div className="container-x space-y-4 py-6">
          <div className="h-8 w-2/3 max-w-md animate-pulse rounded-xl bg-mint-100" />
          <div className="h-4 w-1/2 max-w-sm animate-pulse rounded-lg bg-mint-100/70" />
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div className="h-40 animate-pulse rounded-2xl bg-mint-100/70" />
            <div className="h-40 animate-pulse rounded-2xl bg-mint-100/70" />
          </div>
          <div className="h-24 animate-pulse rounded-2xl bg-mint-100/50" />
        </div>
      </main>
      <MobileTabBar />
    </>
  );
}
