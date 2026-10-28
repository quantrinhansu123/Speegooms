import type { Metadata } from "next";
import { CustomerDetail } from "@/features/crm/components/customer-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết khách hàng" };

export const instant = false;

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <CustomerDetail customerId={decodeURIComponent(id)} />}</WithParams>;
}
