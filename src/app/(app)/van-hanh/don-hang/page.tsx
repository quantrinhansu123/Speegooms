import type { Metadata } from "next";
import { ContractsLiveView } from "@/features/crm/live/contracts-live-view";

export const metadata: Metadata = { title: "Hợp đồng" };

export const instant = false;

export default function OrdersPage() {
  return <ContractsLiveView mode="ops" />;
}
