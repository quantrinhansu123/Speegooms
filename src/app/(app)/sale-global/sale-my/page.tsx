import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SaleUsView } from "@/features/sales/sales-views";

export const metadata: Metadata = { title: "Sale Mỹ" };

export const instant = false;

export default function Page() {
  return <>
    <PageHeader title="Sale Mỹ" description="RFQ của tuyến Global có điểm đến Hoa Kỳ: theo dõi giá, báo giá và hợp đồng." />
    <SaleUsView />
  </>;
}
