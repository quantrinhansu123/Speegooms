import type { Metadata } from "next";
import { SourcingRequestsView } from "@/features/operations/components/sourcing-requests-view";

export const metadata: Metadata = { title: "Sourcing" };

export default function SourcingPage() {
  return <SourcingRequestsView />;
}
