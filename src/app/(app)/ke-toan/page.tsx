import type { Metadata } from "next";
import { AccountingDashboard } from "@/features/accounting/components/accounting-dashboard";

export const metadata: Metadata = { title: "Tài chính vận hành" };

export default function AccountingPage() {
  return <AccountingDashboard />;
}
