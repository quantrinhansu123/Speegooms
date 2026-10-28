import type { Metadata } from "next";
import { SourcingRequestDetail } from "@/features/operations/components/sourcing-request-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Yêu cầu tìm nguồn" };

export const instant = false;

export default function SourcingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <SourcingRequestDetail requestId={decodeURIComponent(id)} />}</WithParams>;
}
