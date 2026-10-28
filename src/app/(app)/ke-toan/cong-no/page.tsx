import type { Metadata } from "next";
import { DebtsView } from "@/features/accounting/components/debts-view";

export const metadata: Metadata = { title: "Công nợ" };

export const instant = false;

export default function DebtsPage() {
  return <DebtsView />;
}
