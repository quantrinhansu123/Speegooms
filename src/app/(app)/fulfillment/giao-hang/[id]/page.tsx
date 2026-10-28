import type { Metadata } from "next";
import { DeliveryDetail } from "@/features/fulfillment/components/delivery-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết giao hàng" };

export const instant = false;

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <DeliveryDetail deliveryId={decodeURIComponent(id)} />}</WithParams>;
}
