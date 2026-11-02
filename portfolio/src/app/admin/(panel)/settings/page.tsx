import { SettingsForm } from "@/components/admin/SettingsForm";
import type { Values } from "@/components/admin/fields";
import { loadSettings } from "@/lib/content/queries";

export const metadata = { title: "Profile & site" };

export default async function SettingsPage() {
  const settings = await loadSettings();
  return <SettingsForm initial={JSON.parse(JSON.stringify(settings)) as Values} />;
}
