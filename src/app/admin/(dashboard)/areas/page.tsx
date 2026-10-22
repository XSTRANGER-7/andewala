import type { Metadata } from "next";
import { ZoneManager } from "@/components/admin/ZoneManager";
import { getSettings } from "@/server/settings";
import { listZones } from "@/server/zones";
import { coverageCenter } from "@/lib/zones";

export const metadata: Metadata = { title: "Delivery areas" };

export default async function AreasPage() {
  const [zones, settings] = await Promise.all([listZones(), getSettings()]);
  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h1 className="font-display text-2xl font-bold">Delivery areas</h1>
        <p className="text-sm text-ink-2">
          Draw where you deliver: a circle around each hub, plus custom areas for special neighbourhoods. Customers can only save addresses and order inside an active area.
        </p>
      </header>
      <ZoneManager zones={zones} start={coverageCenter({ zones, pincodes: [] })} pincodes={settings.pincodes} />
    </div>
  );
}
