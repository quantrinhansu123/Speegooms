import type { Metadata } from "next";
import { ContractsView } from "@/features/crm/components/contracts-view";

export const metadata: Metadata = { title: "Hợp đồng và cọc" };

export const instant = false;

export default function ContractsPage() {
  return <ContractsView />;
}
