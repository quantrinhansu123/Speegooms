import type { Metadata } from "next";
import { SettingsView } from "@/features/settings/settings-view";

export const metadata: Metadata = { title: "Cài đặt" };

export const instant = false;

export default function Page() {
  return <SettingsView />;
}
