import type { Metadata } from "next";
import { ShipmentsView } from "@/features/operations/components/shipments-view";

export const metadata: Metadata = { title: "Logistics" };

export default function LogisticsPage() {
  return <ShipmentsView />;
}
