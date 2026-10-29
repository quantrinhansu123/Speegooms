import type { Metadata } from "next";
import { RfqQuotesView } from "@/features/crm/live/rfq-quotes-view";

export const metadata: Metadata = { title: "Báo giá (RFQ)" };

export const instant = false;

export default function Page() {
  return <RfqQuotesView lane="vn" />;
}
