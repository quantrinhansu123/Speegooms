import type { Metadata } from "next";
import { ContractsView } from "@/features/crm/components/contracts-view";

export const metadata: Metadata = { title: "Hợp đồng" };

export const instant = false;

export default function Page() {
  return <ContractsView routeScope="global" />;
}
