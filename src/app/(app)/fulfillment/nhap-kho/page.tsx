import type { Metadata } from "next";
import { InboundView } from "@/features/fulfillment/components/inbound-view";

export const metadata: Metadata = { title: "Nhập kho" };

export default function InboundPage() {
  return <InboundView />;
}
