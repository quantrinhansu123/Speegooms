import type { Metadata } from "next";
import { SupplierDetail } from "@/features/operations/components/supplier-detail";

export const metadata: Metadata = { title: "Chi tiết nhà cung cấp" };

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierDetail supplierId={decodeURIComponent(id)} />;
}
