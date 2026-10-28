import type { Metadata } from "next";
import { PackageDetail } from "@/features/fulfillment/components/package-detail";

export const metadata: Metadata = { title: "Chi tiết kiện hàng" };

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PackageDetail packageId={decodeURIComponent(id)} />;
}
