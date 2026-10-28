import type { Metadata } from "next";
import { SourcingRequestsView } from "@/features/operations/components/sourcing-requests-view";

export const metadata: Metadata = { title: "Sourcing" };

export const instant = false;

export default function SourcingPage() {
  return <SourcingRequestsView />;
}
