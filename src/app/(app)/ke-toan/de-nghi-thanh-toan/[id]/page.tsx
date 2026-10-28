import type { Metadata } from "next";
import { PaymentDetail } from "@/features/accounting/components/payment-detail";

export const metadata: Metadata = { title: "Chi tiết đề nghị thanh toán" };

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentDetail paymentId={decodeURIComponent(id)} />;
}
