"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ShopStatus, StoreMode } from "@/lib/types";
import { setOutOfStockAction, setStoreModeAction } from "@/server/actions/admin";

type Props = { mode: StoreMode; outOfStock: boolean; hours: string; status: ShopStatus };

const MODES: { id: StoreMode; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Follow store hours" },
  { id: "open", label: "Open", hint: "Take orders now" },
  { id: "closed", label: "Closed", hint: "Stop all orders" },
];

/** The admin's store switch: open/closed/automatic hours, and out of stock. */
export function StoreControls({ mode, outOfStock, hours, status }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; errors: Record<string, string> }>) =>
    start(async () => {
      const res = await fn();
      toast(res.ok ? res.message : (res.errors.form ?? "That didn't save."), res.ok ? "default" : "error");
      router.refresh();
    });

  return (
    <section className={cn("card grid gap-4 transition-opacity lg:grid-cols-[1fr_auto_auto] lg:items-center lg:gap-6", pending && "opacity-70")} aria-label="Store status">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
          {status.open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />}
          <span className={cn("relative inline-flex h-3 w-3 rounded-full", status.open ? "bg-good" : "bg-bad")} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{status.open ? "Store is open" : status.text}</p>
          <p className="text-xs text-ink-3">
            {status.open ? "Customers can order now." : "Customers see a closed sign and can't order."} Hours {hours}.
          </p>
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="eyebrow">Store</span>
        <div className="grid grid-cols-3 rounded-xl bg-mint-100 p-1" role="radiogroup" aria-label="Store mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              disabled={pending}
              title={m.hint}
              onClick={() => mode !== m.id && run(() => setStoreModeAction(m.id))}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition sm:px-4",
                mode === m.id
                  ? m.id === "closed"
                    ? "bg-bad text-white shadow"
                    : m.id === "open"
                      ? "bg-forest-900 text-white shadow"
                      : "bg-paper text-forest-900 shadow"
                  : "text-ink-2 hover:text-ink",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-ink-3">{MODES.find((m) => m.id === mode)?.hint}</span>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 lg:min-w-52">
        <span className="grid">
          <span className="text-sm font-semibold">Out of stock</span>
          <span className="text-[11px] text-ink-3">{outOfStock ? "Showing the Out of stock sign" : "Turn on when eggs run out"}</span>
        </span>
        <span className="relative inline-flex">
          <input
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={outOfStock}
            disabled={pending}
            onChange={(e) => run(() => setOutOfStockAction(e.target.checked))}
          />
          <span className="h-7 w-12 rounded-full bg-line transition peer-checked:bg-bad peer-focus-visible:ring-2 peer-focus-visible:ring-forest-900 peer-focus-visible:ring-offset-2" />
          <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </span>
      </label>
    </section>
  );
}
