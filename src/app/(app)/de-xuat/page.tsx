import type { Metadata } from "next";
import { ApprovalsView } from "@/features/approvals/approvals-view";

export const metadata: Metadata = { title: "Đề xuất" };

export const instant = false;

export default function Page() {
  return <ApprovalsView />;
}
