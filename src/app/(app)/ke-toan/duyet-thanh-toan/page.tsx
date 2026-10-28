import type { Metadata } from "next";
import { ApprovalsView } from "@/features/accounting/components/approvals-view";

export const metadata: Metadata = { title: "Duyệt thanh toán" };

export default function ApprovalsPage() {
  return <ApprovalsView />;
}
