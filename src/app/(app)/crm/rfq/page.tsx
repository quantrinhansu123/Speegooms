import type { Metadata } from "next";
import { RfqsView } from "@/features/crm/components/rfqs-view";

export const metadata: Metadata = { title: "RFQ" };

export const instant = false;

export default function RfqPage() {
  return <RfqsView />;
}
