import type { Metadata } from "next";
import { OutboundDetail } from "@/features/fulfillment/components/outbound-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết lệnh pick/pack" };

export const instant = false;

export default function OutboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <OutboundDetail outboundId={decodeURIComponent(id)} />}</WithParams>;
}
