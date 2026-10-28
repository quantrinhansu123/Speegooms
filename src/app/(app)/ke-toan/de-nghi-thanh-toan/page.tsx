import type { Metadata } from "next";
import { PaymentsView } from "@/features/accounting/components/payments-view";

export const metadata: Metadata = { title: "Đề nghị thanh toán" };

export default function PaymentsPage() {
  return <PaymentsView />;
}
