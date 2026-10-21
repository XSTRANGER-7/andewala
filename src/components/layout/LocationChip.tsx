"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { IconCheck, IconPin } from "@/components/ui/Icons";
import { ButtonLink, Spinner } from "@/components/ui/Button";
import { detectLocation, ensureLocated, saveLocated, shortLabel, useLocated } from "@/lib/addresses";
import { cn } from "@/lib/cn";
import { setDefaultAddressAction } from "@/server/actions/account";

export type ChipAddress = { id: string; label: string; address: string; landmark: string; pincode: string; isDefault: boolean };

/**
 * "Deliver to ..." in the header. Logged in: shows the default saved address and
 * lets the customer switch it. Not logged in: can look up the current area and
 * offers to log in to save addresses.
 */
export function LocationChip({ zone, pincodes, addresses }: { zone: string; pincodes: string[]; addresses: ChipAddress[] | null }) {
  const router = useRouter();
  const located = useLocated();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loggedIn = addresses !== null;
  const active = addresses?.find((a) => a.isDefault) ?? addresses?.[0] ?? null;
  const current = active ? shortLabel(active) : located ? [located.area, located.pincode].filter(Boolean).join(" · ") : null;
  const pin = active?.pincode || located?.pincode || "";
  const outside = !!pin && pincodes.length > 0 && !pincodes.includes(pin);

  // Find the visitor's location as soon as the site opens, unless we already have it.
  useEffect(() => {
    void ensureLocated();
  }, []);

  async function locate() {
    setBusy(true);
    setError("");
    try {
      saveLocated(await detectLocation());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get your location.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(id: string) {
    setSwitching(id);
    await setDefaultAddressAction(id);
    setSwitching(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-w-0 max-w-full items-center gap-2 rounded-full py-1 pl-1.5 pr-1.5 text-left max-[379px]:pl-1 max-[379px]:pr-1 transition hover:bg-mint-100 sm:pl-1 sm:pr-2"
        aria-label={current ? `Delivering to ${current}. Change address` : "Set delivery location"}
      >
        <span className={cn("hidden h-8 w-8 shrink-0 place-items-center rounded-full sm:grid", outside ? "bg-warn-soft text-warn" : "bg-mint-100 text-forest-900 group-hover:bg-paper")}>
          <IconPin width={16} height={16} />
        </span>
        <span className="grid min-w-0 leading-tight">
          <span className="flex min-w-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3 max-[379px]:text-[9px] max-[379px]:tracking-normal">
            <span className={cn("live-dot relative inline-block h-1.5 w-1.5 shrink-0 rounded-full", outside ? "bg-warn" : "bg-good")} aria-hidden="true" />
            <span className="truncate">Deliver to</span>
          </span>
          <span className="flex min-w-0 items-center gap-1 text-[13px] font-semibold text-ink max-[379px]:text-[12px]">
            <span className="truncate">{current ?? "Set location"}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-ink-3" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Deliver to">
        {loggedIn ? (
          <div className="grid gap-2">
            <p className="eyebrow">Your addresses</p>
            {addresses.length === 0 ? (
              <p className="text-sm text-ink-2">No saved addresses yet. Add one and it is used for every order.</p>
            ) : (
              <ul className="grid gap-2">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => choose(a.id)}
                      disabled={!!switching}
                      className={cn("flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition disabled:opacity-60", a.id === active?.id ? "border-forest-900 bg-mint-100" : "border-line hover:border-ink-3")}
                    >
                      <span className="grid min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {a.label}
                          {a.id === active?.id && <IconCheck width={14} height={14} className="text-forest-900" />}
                          {pincodes.length > 0 && !pincodes.includes(a.pincode) && <span className="text-[11px] font-semibold text-warn">Outside delivery area</span>}
                        </span>
                        <span className="truncate text-xs text-ink-2">
                          {a.address} · {a.pincode}
                        </span>
                      </span>
                      {switching === a.id && <Spinner />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/account/addresses" onClick={() => setOpen(false)} className="text-sm font-semibold text-forest-900 hover:underline">
              + Add or edit addresses
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            <button
              type="button"
              onClick={locate}
              disabled={busy}
              className="flex items-center gap-3 rounded-lg border border-line px-3.5 py-3 text-left text-sm font-semibold text-forest-900 transition hover:bg-mint-50 disabled:opacity-60"
            >
              {busy ? <Spinner /> : <IconPin />}
              <span className="grid">
                Use my current location
                {located && <span className="text-xs font-normal text-ink-3">Last found: {[located.area, located.pincode].filter(Boolean).join(" · ")}</span>}
              </span>
            </button>
            {error && <p className="text-xs text-bad">{error}</p>}
            <div className="grid gap-2 rounded-lg bg-mint-50 p-3">
              <p className="text-sm text-ink-2">Log in to save your addresses and order in a few taps.</p>
              <ButtonLink href="/login?next=/account" variant="sage" size="sm" className="w-max" prefetch={false}>
                Log in or sign up
              </ButtonLink>
            </div>
          </div>
        )}

        <p className={cn("text-xs", outside ? "text-warn" : "text-ink-3")}>
          {outside ? `We don't deliver to ${pin} yet. ` : ""}
          {pincodes.length ? `We deliver to ${pincodes.join(", ")}.` : `We deliver across ${zone}.`}
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-mint-100">
            Done
          </button>
        </div>
      </Modal>
    </>
  );
}
