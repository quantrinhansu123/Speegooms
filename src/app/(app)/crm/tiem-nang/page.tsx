import type { Metadata } from "next";
import { PotentialView } from "@/features/crm/live/potential-view";

export const metadata: Metadata = { title: "Khách hàng tiềm năng" };

export const instant = false;

export default function PotentialPage() {
  return <PotentialView />;
}
