import type { Metadata } from "next";
import { SettlementDetail } from "@/features/accounting/components/settlement-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết quyết toán" };

export const instant = false;

export default function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <SettlementDetail orderId={decodeURIComponent(id)} />}</WithParams>;
}
