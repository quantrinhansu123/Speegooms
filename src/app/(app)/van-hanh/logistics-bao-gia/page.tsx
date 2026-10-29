import type { Metadata } from "next";
import { LogisticsQuotesView } from "@/features/operations/components/logistics-quotes-view";

export const metadata: Metadata = { title: "Logistics – Báo giá" };

export const instant = false;

export default function Page() {
  return <LogisticsQuotesView />;
}
