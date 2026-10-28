import type { Metadata } from "next";
import { PoDetail } from "@/features/operations/components/po-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết PO" };

export const instant = false;

export default function PoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <PoDetail poId={decodeURIComponent(id)} />}</WithParams>;
}
