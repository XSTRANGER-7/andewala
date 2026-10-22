"use client";

import { usePathname } from "next/navigation";
import { AddToCart } from "@/components/cart/AddToCart";
import { useStoreStatus } from "@/components/store/StoreStatus";
import { IconPin } from "@/components/ui/Icons";
import { formatDistance } from "@/lib/geo";
import { usesZones, type Coverage } from "@/lib/zones";
import type { ChipAddress } from "./LocationChip";
import { OPEN_LOCATION_EVENT, useDeliverySpot } from "./useDeliverySpot";

const HIDDEN_ON = ["/cart", "/login", "/admin", "/order/"];

/**
 * Strip under the header that tells visitors, before they try to order,
 * whether we deliver where they are:
 * - far outside: "Not deliverable at your location", with a way to change it;
 * - just outside (within 200 m of an area): we can still deliver, "Order here".
 * Nothing is shown inside an area or when we don't know the location.
 */
export function DeliveryNotice({ coverage, area, addresses }: { coverage: Coverage; area: string; addresses: ChipAddress[] | null }) {
  const pathname = usePathname();
  const spot = useDeliverySpot(coverage, addresses);
  const store = useStoreStatus();
  const canOrder = !store || store.open;
  if (!spot.result || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/"))) return null;
  const r = spot.result;
  const where = spot.label ? <b className="font-semibold">{spot.label}</b> : "your location";
  const change = (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_LOCATION_EVENT))}
      className="h-8 shrink-0 rounded-full bg-paper px-3 text-xs font-bold text-ink shadow-sm ring-1 ring-line transition hover:bg-mint-50"
    >
      Change location
    </button>
  );

  if (r.status === "outside") {
    return (
      <div role="status" className="border-b border-bad/20 bg-bad/[0.07]" data-delivery-notice="outside">
        <div className="container-x flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bad/10 text-bad" aria-hidden="true">
            <IconPin width={16} height={16} />
          </span>
          <p className="min-w-0 flex-1 basis-[calc(100%-3rem)] text-sm text-ink sm:basis-0">
            <b className="text-bad">Not deliverable at your location.</b> {where}
            {r.distanceM !== null && usesZones(coverage) ? ` is ${formatDistance(r.distanceM)} from our nearest delivery area${r.zone ? ` (${r.zone.name})` : ""}.` : " is outside our delivery area."}{" "}
            <span className="hidden text-ink-2 sm:inline">We deliver in {area}.</span>
          </p>
          <div className="flex w-full shrink-0 gap-2 pl-11 sm:w-auto sm:pl-0">{change}</div>
        </div>
      </div>
    );
  }

  if (r.status === "near") {
    return (
      <div role="status" className="border-b border-yolk/30 bg-yolk-soft" data-delivery-notice="near">
        <div className="container-x flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper text-yolk-ink" aria-hidden="true">
            <IconPin width={16} height={16} />
          </span>
          <p className="min-w-0 flex-1 basis-[calc(100%-3rem)] text-sm text-ink sm:basis-0">
            <b>You&apos;re just outside our delivery area</b> ({formatDistance(r.distanceM)} from {r.zone.name}). We can still deliver to {where}.
          </p>
          <div className="flex w-full shrink-0 gap-2 pl-11 sm:w-auto sm:pl-0">
            {canOrder && (
              <AddToCart size="sm" variant="primary" className="h-8 px-3 text-xs">
                Order here
              </AddToCart>
            )}
            {change}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
