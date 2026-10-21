import { EggTray } from "@/components/art/EggTray";
import { ButtonLink } from "@/components/ui/Button";
import { SiteShell } from "@/components/layout/SiteShell";

export default function NotFound() {
  return (
    <SiteShell>
      <div className="container-x grid justify-items-center gap-4 py-24 text-center">
        <EggTray filled={0} className="w-40" />
        <h1 className="font-display text-3xl font-bold">Nothing in this tray</h1>
        <p className="max-w-md text-ink-2">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <ButtonLink href="/" variant="sage">
          Back to the store
        </ButtonLink>
      </div>
    </SiteShell>
  );
}
