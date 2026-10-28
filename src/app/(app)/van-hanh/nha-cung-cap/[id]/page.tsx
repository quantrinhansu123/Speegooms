import type { Metadata } from "next";
import { SupplierDetail } from "@/features/operations/components/supplier-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết nhà cung cấp" };

export const instant = false;

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <SupplierDetail supplierId={decodeURIComponent(id)} />}</WithParams>;
}
