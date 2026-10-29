import type { Metadata } from "next";
import { QuoteDeskView } from "@/features/crm/live/quotes-view";

export const metadata: Metadata = { title: "Logistics – Báo giá" };

export const instant = false;

export default function Page() {
  return <QuoteDeskView desk="logistics" />;
}
