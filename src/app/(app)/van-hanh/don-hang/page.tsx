import type { Metadata } from "next";
import { OrdersView } from "@/features/operations/components/orders-view";

export const metadata: Metadata = { title: "Đơn hàng" };

export const instant = false;

export default function OrdersPage() {
  return <OrdersView />;
}
