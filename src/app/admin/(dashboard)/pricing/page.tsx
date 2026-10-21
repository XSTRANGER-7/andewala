import { PricingForms } from "@/components/admin/PricingForms";
import { availableTrays, reservedTrays } from "@/lib/availability";
import { effectivePrice } from "@/lib/pricing";
import { nowIst } from "@/lib/time";
import { getBookings } from "@/server/orders";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const now = nowIst();
  const [settings, bookings] = await Promise.all([getSettings(), getBookings(undefined, now.date)]);
  const ep = effectivePrice(settings, now.date);
  return (
    <PricingForms
      settings={{ ...settings, priceUpdatedAt: settings.priceUpdatedAt?.toISOString() ?? null }}
      price={ep.price}
      today={now.date}
      available={availableTrays(settings, bookings)}
      reserved={reservedTrays(bookings)}
    />
  );
}
