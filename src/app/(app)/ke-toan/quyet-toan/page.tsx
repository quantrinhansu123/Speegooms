import type { Metadata } from "next";
import { SettlementsView } from "@/features/accounting/components/settlements-view";

export const metadata: Metadata = { title: "Quyết toán hợp đồng" };

export const instant = false;

export default function SettlementsPage() {
  return <SettlementsView />;
}
