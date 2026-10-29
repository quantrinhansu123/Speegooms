import type { Metadata } from "next";
import { RfqsView } from "@/features/crm/components/rfqs-view";

export const metadata: Metadata = { title: "Báo giá (RFQ)" };

export const instant = false;

export default function Page() {
  return <RfqsView routeScope="vn" />;
}
