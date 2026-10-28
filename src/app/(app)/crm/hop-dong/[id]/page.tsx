import type { Metadata } from "next";
import { ContractDetail } from "@/features/crm/components/contract-detail";

export const metadata: Metadata = { title: "Chi tiết hợp đồng" };

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContractDetail orderId={decodeURIComponent(id)} />;
}
