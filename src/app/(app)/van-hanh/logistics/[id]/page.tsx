import type { Metadata } from "next";
import { ShipmentDetail } from "@/features/operations/components/shipment-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết lô hàng" };

export const instant = false;

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <ShipmentDetail shipmentId={decodeURIComponent(id)} />}</WithParams>;
}
