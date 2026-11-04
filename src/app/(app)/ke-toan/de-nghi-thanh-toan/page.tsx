import type { Metadata } from "next";
import { PaymentsLiveView } from "@/features/accounting/live/payments-live-view";

export const metadata: Metadata = { title: "Đề nghị thanh toán" };

export const instant = false;

export default function PaymentsPage() {
  return <PaymentsLiveView />;
}
