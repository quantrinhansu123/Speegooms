import type { Metadata } from "next";
import { OrderDetail } from "@/features/operations/components/order-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết đơn hàng" };

export const instant = false;

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <OrderDetail orderId={decodeURIComponent(id)} />}</WithParams>;
}
