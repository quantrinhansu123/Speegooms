import type { Metadata } from "next";
import { PayrollView } from "@/features/accounting/components/payroll-view";

export const metadata: Metadata = { title: "Lương & chi phí nội bộ" };

export const instant = false;

export default function Page() {
  return <PayrollView />;
}
