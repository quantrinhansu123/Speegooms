import type { Metadata } from "next";
import { DebtsView } from "@/features/accounting/components/debts-view";

export const metadata: Metadata = { title: "Công nợ" };

export default function DebtsPage() {
  return <DebtsView />;
}
