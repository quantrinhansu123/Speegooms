import type { Metadata } from "next";
import { DepositDetail } from "@/features/accounting/components/deposit-detail";

export const metadata: Metadata = { title: "Xác nhận đã cọc" };

export default async function DepositDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DepositDetail orderId={decodeURIComponent(id)} />;
}
