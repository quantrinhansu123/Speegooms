import type { Metadata } from "next";
import { PoDetail } from "@/features/operations/components/po-detail";

export const metadata: Metadata = { title: "Chi tiết PO" };

export default async function PoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PoDetail poId={decodeURIComponent(id)} />;
}
