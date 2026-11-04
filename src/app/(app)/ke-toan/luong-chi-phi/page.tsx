import type { Metadata } from "next";
import { PayrollLiveView } from "@/features/accounting/live/payroll-live-view";

export const metadata: Metadata = { title: "Lương & chi phí nội bộ" };

export const instant = false;

export default function Page() {
  return <PayrollLiveView />;
}
