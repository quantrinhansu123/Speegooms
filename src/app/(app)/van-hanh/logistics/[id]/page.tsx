import type { Metadata } from "next";
import { ShipmentDetail } from "@/features/operations/components/shipment-detail";

export const metadata: Metadata = { title: "Chi tiết lô hàng" };

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShipmentDetail shipmentId={decodeURIComponent(id)} />;
}
