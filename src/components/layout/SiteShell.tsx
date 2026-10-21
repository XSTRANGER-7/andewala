import type { ReactNode } from "react";
import { connection } from "next/server";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { PromoBar } from "./PromoBar";
import { MobileTabBar } from "./MobileTabBar";
import { getSettings } from "@/server/settings";
import { getUser } from "@/server/customer-auth";
import { listAddresses } from "@/server/accounts";
import { listCustomerOrders } from "@/server/orders";
import { ACTIVE_STATUSES } from "@/lib/types";

/** Public page chrome: promo strip, header (with cart badge), content, footer, and the phone tab bar. */
export async function SiteShell({ children }: { children: ReactNode }) {
  // Always render per request: the header and footer show live store data, and
  // pages like the 404 would otherwise be built once with stale settings.
  await connection();
  const [settings, user] = await Promise.all([getSettings(), getUser()]);
  const [orders, addresses] = user ? await Promise.all([listCustomerOrders(user.id), listAddresses(user.id)]) : [[], null];
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
  const area = settings.pincodes.length ? settings.pincodes.join(", ") : settings.areaName;
  return (
    <>
      <PromoBar s={settings} />
      <Header storeName={settings.storeName} area={area} pincodes={settings.pincodes} activeOrders={activeOrders} addresses={addresses} />
      <main className="flex-1 pb-14 lg:pb-0">{children}</main>
      <Footer settings={settings} />
      <MobileTabBar />
    </>
  );
}
