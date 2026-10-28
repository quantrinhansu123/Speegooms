import type { Metadata } from "next";
import { ContractDetail } from "@/features/crm/components/contract-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết hợp đồng" };

export const instant = false;

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <ContractDetail orderId={decodeURIComponent(id)} />}</WithParams>;
}
