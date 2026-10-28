import type { Metadata } from "next";
import { OrderDetail } from "@/features/operations/components/order-detail";

export const metadata: Metadata = { title: "Chi tiết đơn hàng" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetail orderId={decodeURIComponent(id)} />;
}
