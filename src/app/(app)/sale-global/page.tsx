import type { Metadata } from "next";
import { SaleTeamView } from "@/features/sales/sales-views";

export const metadata: Metadata = { title: "Sale Global" };

export const instant = false;

export default function Page() {
  return <SaleTeamView route="global" />;
}
