import type { Metadata } from "next";
import { QuotationsView } from "@/features/crm/components/quotations-view";

export const metadata: Metadata = { title: "Báo giá" };

export default function QuotationsPage() {
  return <QuotationsView />;
}
