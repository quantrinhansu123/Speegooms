import type { Metadata } from "next";
import { PaymentDetail } from "@/features/accounting/components/payment-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết đề nghị thanh toán" };

export const instant = false;

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <PaymentDetail paymentId={decodeURIComponent(id)} />}</WithParams>;
}
