import type { Metadata } from "next";
import { RfqDetail } from "@/features/crm/components/rfq-detail";

export const metadata: Metadata = { title: "Chi tiết RFQ" };

export default async function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RfqDetail rfqId={decodeURIComponent(id)} />;
}
