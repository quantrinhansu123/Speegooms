import type { Metadata } from "next";
import { QuoteDeskView } from "@/features/crm/live/quotes-view";

export const metadata: Metadata = { title: "Báo cáo Vận hành" };
export const instant = false;

export default function Page() {
  return <QuoteDeskView desk="logistics" report />;
}
