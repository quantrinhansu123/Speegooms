import type { Metadata } from "next";
import { OperationsReport } from "@/features/operations/operations-report";

export const metadata: Metadata = { title: "Báo cáo Vận hành" };
export const instant = false;

export default function Page() {
  return <OperationsReport />;
}
