import type { Metadata } from "next";
import { DepositDetail } from "@/features/accounting/components/deposit-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Xác nhận đã cọc" };

export const instant = false;

export default function DepositDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <DepositDetail orderId={decodeURIComponent(id)} />}</WithParams>;
}
