import type { Metadata } from "next";
import { QuoteDeskView } from "@/features/crm/live/quotes-view";

export const metadata: Metadata = { title: "Sourcing – Báo giá" };

export const instant = false;

export default function SourcingPage() {
  return <QuoteDeskView desk="sourcing" />;
}
