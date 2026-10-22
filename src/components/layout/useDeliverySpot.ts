"use client";

import { useMemo } from "react";
import { shortLabel, useLocated } from "@/lib/addresses";
import { coverageAt, type Coverage, type CoverageAt } from "@/lib/zones";
import type { ChipAddress } from "./LocationChip";

/** Fired to open the header's "Deliver to" picker from elsewhere on the page. */
export const OPEN_LOCATION_EVENT = "andewala:open-location";

export type DeliverySpot = {
  /** What the header shows: the default saved address, or the area found from the device's location. */
  label: string | null;
  /** Coverage of that spot (null when we don't know where the visitor is). */
  result: CoverageAt | null;
  /** True when the spot is the device's live location rather than a saved address. */
  live: boolean;
};

/**
 * Where we'd deliver to right now, and whether we can: the logged-in
 * customer's default address (when it has a map pin), otherwise the location
 * found from their device when the site opened.
 */
export function useDeliverySpot(coverage: Coverage, addresses: ChipAddress[] | null): DeliverySpot {
  const located = useLocated();
  return useMemo(() => {
    const active = addresses?.find((a) => a.isDefault) ?? addresses?.[0] ?? null;
    if (active && active.lat !== null && active.lng !== null) {
      return { label: shortLabel(active), result: coverageAt(coverage, active), live: false };
    }
    if (located && located.lat != null && located.lng != null) {
      return { label: [located.area, located.pincode].filter(Boolean).join(" · "), result: coverageAt(coverage, located), live: true };
    }
    if (active) return { label: shortLabel(active), result: coverageAt(coverage, active), live: false };
    if (located) return { label: [located.area, located.pincode].filter(Boolean).join(" · "), result: coverageAt(coverage, located), live: true };
    return { label: null, result: null, live: false };
  }, [addresses, located, coverage]);
}
