import type { Metadata } from "next";
import { InquiriesView } from "@/features/fulfillment/components/inquiries-view";

export const metadata: Metadata = { title: "Hỏi tình trạng đơn" };

export default function InquiriesPage() {
  return <InquiriesView />;
}
