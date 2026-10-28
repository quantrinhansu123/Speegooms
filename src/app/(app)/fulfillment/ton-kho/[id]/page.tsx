import type { Metadata } from "next";
import { PackageDetail } from "@/features/fulfillment/components/package-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết kiện hàng" };

export const instant = false;

export default function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <PackageDetail packageId={decodeURIComponent(id)} />}</WithParams>;
}
