"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ShopStatus } from "@/lib/types";

/** Live store status for every order button on the page (set by the page shell). */
const StoreStatusContext = createContext<ShopStatus | null>(null);

export function StoreStatusProvider({ status, children }: { status: ShopStatus; children: ReactNode }) {
  return <StoreStatusContext.Provider value={status}>{children}</StoreStatusContext.Provider>;
}

/** The store's status, or null outside the storefront (treated as open). */
export function useStoreStatus(): ShopStatus | null {
  return useContext(StoreStatusContext);
}

type BoardSize = "sm" | "md" | "lg";

const sizes: Record<BoardSize, { wrap: string; button: string; board: string; title: string; sub: string; string: number }> = {
  sm: { wrap: "pt-6", button: "h-10 text-sm", board: "px-4 py-1.5", title: "text-sm", sub: "text-[10px]", string: 24 },
  md: { wrap: "pt-7", button: "h-11 text-sm", board: "px-5 py-2", title: "text-base", sub: "text-[11px]", string: 28 },
  lg: { wrap: "pt-8", button: "h-14 text-base", board: "px-6 py-2.5", title: "text-xl", sub: "text-xs", string: 32 },
};

/**
 * A wooden "Closed" / "Out of stock" sign hanging on a nail over a disabled
 * order button. The button stays in the page (greyed out, not clickable) so
 * the layout doesn't jump and screen readers hear why ordering is off.
 */
export function ClosedButton({
  board,
  detail,
  size = "lg",
  className,
}: {
  board: { title: string; sub: string };
  detail?: string;
  size?: BoardSize;
  className?: string;
}) {
  const z = sizes[size];
  return (
    <div className={cn("relative min-w-48", z.wrap, className)}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={cn("w-full cursor-not-allowed rounded-xl border-2 border-dashed border-line bg-mint-100/70 font-semibold text-ink-3", z.button)}
      >
        <span className="sr-only">
          {board.title}. {detail ?? board.sub}
        </span>
      </button>
      {/* the sign: nail, two strings, wooden board; swings gently */}
      <div className="hanging-sign pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center" aria-hidden="true">
        <svg width="84" height={z.string} viewBox={`0 0 84 ${z.string}`} className="-mb-1 overflow-visible">
          <line x1="42" y1="4" x2="12" y2={z.string} stroke="#6b4a2b" strokeWidth="1.6" />
          <line x1="42" y1="4" x2="72" y2={z.string} stroke="#6b4a2b" strokeWidth="1.6" />
          <circle cx="42" cy="4" r="4" fill="#9aa6a0" stroke="#5f6b66" strokeWidth="1" />
          <circle cx="41" cy="3" r="1.2" fill="#fff" opacity=".7" />
        </svg>
        <div className={cn("wood-board relative min-w-[8.5rem] rounded-lg text-center shadow-[0_6px_14px_-4px_rgb(60_35_10/.55)]", z.board)}>
          <span className="absolute left-2.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#3b2412]/70" />
          <span className="absolute right-2.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#3b2412]/70" />
          <div className="rounded-md border border-dashed border-[#f6e6c8]/45 px-3 py-1">
            <div className={cn("font-display font-extrabold uppercase leading-none tracking-[0.12em] text-[#fff4dc] drop-shadow-[0_1px_0_rgb(0_0_0/.35)]", z.title)}>{board.title}</div>
            <div className={cn("mt-1 font-semibold leading-none text-[#f6d79a]", z.sub)}>{board.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A large hanging sign for the top of the cart while the store is closed. */
export function ClosedBanner({ status }: { status: ShopStatus }) {
  if (!status.board) return null;
  return (
    <section className="card grid items-center gap-4 overflow-hidden sm:grid-cols-[auto_1fr] sm:gap-6" role="status">
      <div className="mx-auto w-48 sm:mx-0">
        <ClosedButton board={status.board} detail={status.detail} size="lg" className="[&>button]:invisible" />
      </div>
      <div className="grid gap-1 text-center sm:text-left">
        <h2 className="font-display text-xl font-bold">{status.text}</h2>
        <p className="text-sm text-ink-2">{status.detail}</p>
        <p className="text-xs text-ink-3">Your cart is saved on this phone. Come back when we&apos;re open to place the order.</p>
      </div>
    </section>
  );
}
