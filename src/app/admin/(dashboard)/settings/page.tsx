import { SettingsForm } from "@/components/admin/SettingsForm";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  // Strip the Date so the client component receives serialisable props only.
  const { priceUpdatedAt: _priceUpdatedAt, ...rest } = settings;
  void _priceUpdatedAt;
  return <SettingsForm settings={rest} />;
}
