import type { Metadata } from "next";
import { CustomerDetail } from "@/features/crm/components/customer-detail";

export const metadata: Metadata = { title: "Chi tiết khách hàng" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetail customerId={decodeURIComponent(id)} />;
}
