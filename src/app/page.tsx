import { SiteShell } from "@/components/layout/SiteShell";
import { Hero } from "@/components/sections/Hero";
import { Stats } from "@/components/sections/Stats";
import { Highlights } from "@/components/sections/Highlights";
import { About } from "@/components/sections/About";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Testimonials } from "@/components/sections/Testimonials";
import { Areas } from "@/components/sections/Areas";
import { Newsletter } from "@/components/sections/Newsletter";
import { Faq } from "@/components/sections/Faq";
import { getSettings } from "@/server/settings";
import { getAvailability } from "@/server/orders";
import { getPublicStats } from "@/server/stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, availability, stats] = await Promise.all([getSettings(), getAvailability(), getPublicStats()]);
  return (
    <SiteShell>
      <Hero a={availability} />
      <Highlights s={settings} />
      <Stats a={availability} stats={stats} />
      <About s={settings} />
      <HowItWorks a={availability} />
      <Testimonials />
      <Areas s={settings} zoneNames={availability.zones.map((z) => z.name)} />
      <Newsletter />
      <Faq />
    </SiteShell>
  );
}
