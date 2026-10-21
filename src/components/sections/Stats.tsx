import { fmtTime } from "@/lib/time";
import type { Availability } from "@/lib/types";
import type { PublicStats } from "@/server/stats";

/** Four headline promises under "Why AndeWala?". Stock levels are deliberately not shown here. */
export function Stats({ a, stats }: { a: Availability; stats: PublicStats }) {
  const delivery =
    a.deliveryFee === 0
      ? { value: "Free", label: "Home delivery" }
      : a.freeDeliveryFrom > 0
        ? { value: "Free", label: `Home delivery on ${a.freeDeliveryFrom}+ trays` }
        : { value: "Doorstep", label: "Home delivery" };
  const items = [
    delivery,
    { value: fmtTime(a.deadline), label: "Same-day delivery by" },
    { value: "30", label: "Eggs in every tray" },
    stats.traysDelivered > 0 ? { value: stats.traysDelivered.toLocaleString("en-IN"), label: "Trays delivered" } : { value: "Daily", label: "Fresh from the farm" },
  ];
  return (
    <section className="bg-mint-50" aria-label="Our promises">
      <div className="container-x grid grid-cols-2 gap-5 py-8 sm:grid-cols-4 sm:py-12">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <div className="num font-display text-3xl font-bold text-sage-600 sm:text-4xl">{it.value}</div>
            <div className="mt-1 text-xs text-ink-2 sm:text-sm">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
