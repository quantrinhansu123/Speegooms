import type { Metadata } from "next";
import { DeliveryDetail } from "@/features/fulfillment/components/delivery-detail";

export const metadata: Metadata = { title: "Chi tiết giao hàng" };

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliveryDetail deliveryId={decodeURIComponent(id)} />;
}
