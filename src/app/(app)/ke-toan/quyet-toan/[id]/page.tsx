import type { Metadata } from "next";
import { SettlementDetail } from "@/features/accounting/components/settlement-detail";

export const metadata: Metadata = { title: "Chi tiết quyết toán" };

export default async function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SettlementDetail orderId={decodeURIComponent(id)} />;
}
