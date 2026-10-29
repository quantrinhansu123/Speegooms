import type { Metadata } from "next";
import { RfqQuotesView } from "@/features/crm/live/rfq-quotes-view";

export const metadata: Metadata = { title: "RFQ" };

export const instant = false;

export default function RfqPage() {
  return <RfqQuotesView />;
}
