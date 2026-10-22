import { IconPin } from "@/components/ui/Icons";
import type { StoreSettings } from "@/lib/types";

/** Where we deliver, in place of the reference's partner-logo strip. */
export function Areas({ s, zoneNames = [] }: { s: StoreSettings; zoneNames?: string[] }) {
  const items = zoneNames.length ? zoneNames : s.pincodes;
  return (
    <section className="border-y border-line bg-mint-50" aria-label="Delivery areas">
      <div className="container-x flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:justify-center sm:gap-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-forest-900">
          <IconPin /> Delivering to
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          {items.length ? (
            items.map((p) => (
              <span key={p} className="num rounded-full bg-paper px-3 py-1 text-sm text-ink shadow-soft">
                {p}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-paper px-3 py-1 text-sm text-ink shadow-soft">{s.areaName}</span>
          )}
        </div>
      </div>
    </section>
  );
}
