import type { Metadata } from "next";
import { DeliveriesView } from "@/features/fulfillment/components/deliveries-view";

export const metadata: Metadata = { title: "Giao hàng" };

export default function DeliveriesPage() {
  return <DeliveriesView />;
}
