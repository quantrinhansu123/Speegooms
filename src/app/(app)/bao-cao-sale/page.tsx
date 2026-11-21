import type { Metadata } from "next";
import { SalesReportView } from "@/features/reports/sales-report-view";

export const metadata: Metadata = { title: "Báo cáo Sale" };

export default function Page() {
  return <SalesReportView />;
}
