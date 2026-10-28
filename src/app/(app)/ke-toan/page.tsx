import type { Metadata } from "next";
import { AccountingDashboard } from "@/features/accounting/components/accounting-dashboard";

export const metadata: Metadata = { title: "Tài chính vận hành" };

export const instant = false;

export default function AccountingPage() {
  return <AccountingDashboard />;
}
