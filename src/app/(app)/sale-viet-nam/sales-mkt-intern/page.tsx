import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { MktInternQueueView } from "@/features/sales/sales-views";

export const metadata: Metadata = { title: "Sales MKT Intern" };

export const instant = false;

export default function Page() {
  return <>
    <PageHeader title="Sales MKT Intern" description="Hàng đợi lead mới từ Marketing (tuyến Việt Nam) cần tiếp nhận, đặt việc và chăm sóc." />
    <MktInternQueueView />
  </>;
}
