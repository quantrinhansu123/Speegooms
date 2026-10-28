import type { Metadata } from "next";
import { OutboundDetail } from "@/features/fulfillment/components/outbound-detail";

export const metadata: Metadata = { title: "Chi tiết lệnh pick/pack" };

export default async function OutboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OutboundDetail outboundId={decodeURIComponent(id)} />;
}
