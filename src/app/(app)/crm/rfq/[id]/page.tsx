import type { Metadata } from "next";
import { RfqDetail } from "@/features/crm/components/rfq-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết RFQ" };

export const instant = false;

export default function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <RfqDetail rfqId={decodeURIComponent(id)} />}</WithParams>;
}
