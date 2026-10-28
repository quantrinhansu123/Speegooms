import type { Metadata } from "next";
import { InventoryView } from "@/features/fulfillment/components/inventory-view";

export const metadata: Metadata = { title: "Tồn kho" };

export default function InventoryPage() {
  return <InventoryView />;
}
