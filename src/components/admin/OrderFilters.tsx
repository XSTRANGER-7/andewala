"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminOrderFilter } from "@/server/orders";

const DATES: [AdminOrderFilter["date"], string][] = [
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["upcoming", "Today and later"],
  ["all", "All dates"],
];
const STATUSES: [AdminOrderFilter["status"], string][] = [
  ["active", "Still to deliver"],
  ["issues", "Customer reports"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
  ["all", "Everything"],
];

export function OrderFilters({ filter, count, trays }: { filter: AdminOrderFilter; count: number; trays: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: "date" | "status", value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm font-semibold">
        Delivery day
        <select className="input min-w-40" value={filter.date} onChange={(e) => set("date", e.target.value)}>
          {DATES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Status
        <select className="input min-w-40" value={filter.status} onChange={(e) => set("status", e.target.value)}>
          {STATUSES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <span className="pb-2.5 text-sm text-ink-3">
        {count} order{count === 1 ? "" : "s"} · {trays} trays
      </span>
    </div>
  );
}
