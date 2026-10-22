import type { ReactNode } from "react";
import { connection } from "next/server";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { PromoBar } from "./PromoBar";
import { MobileTabBar } from "./MobileTabBar";
import { getSettings } from "@/server/settings";
import { getUser } from "@/server/customer-auth";
import { listAddresses } from "@/server/accounts";
import { countActiveOrders, getAvailability } from "@/server/orders";
import { StoreStatusProvider } from "@/components/store/StoreStatus";
import { coverageText } from "@/lib/zones";
import { DeliveryNotice } from "./DeliveryNotice";

/** Public page chrome: promo strip, header (with cart badge), content, footer, and the phone tab bar. */
export async function SiteShell({ children }: { children: ReactNode }) {
  // Always render per request: the header and footer show live store data, and
  // pages like the 404 would otherwise be built once with stale settings.
  await connection();
  const [settings, user, availability] = await Promise.all([getSettings(), getUser(), getAvailability()]);
  const [activeOrders, addresses] = user ? await Promise.all([countActiveOrders(user.id), listAddresses(user.id)]) : [0, null];
  const coverage = { zones: availability.zones, pincodes: settings.pincodes };
  const area = coverageText(coverage, settings.areaName);
  return (
    <StoreStatusProvider status={availability.status}>
      <PromoBar s={settings} />
      <Header storeName={settings.storeName} area={area} coverage={coverage} activeOrders={activeOrders} addresses={addresses} />
      <DeliveryNotice coverage={coverage} area={area} addresses={addresses} />
      <main className="flex-1 pb-14 lg:pb-0">{children}</main>
      <Footer settings={settings} area={area} />
      <MobileTabBar />
    </StoreStatusProvider>
  );
}
