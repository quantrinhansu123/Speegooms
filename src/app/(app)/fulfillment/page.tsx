import type { Metadata } from "next";
import { FulfillmentDashboard } from "@/features/fulfillment/components/fulfillment-dashboard";

export const metadata: Metadata = { title: "Fulfillment" };

export const instant = false;

export default function FulfillmentPage() {
  return <FulfillmentDashboard />;
}
