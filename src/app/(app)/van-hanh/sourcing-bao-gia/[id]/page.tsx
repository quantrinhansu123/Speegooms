import type { Metadata } from "next";
import { SourcingRequestDetail } from "@/features/operations/components/sourcing-request-detail";

export const metadata: Metadata = { title: "Yêu cầu tìm nguồn" };

export default async function SourcingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SourcingRequestDetail requestId={decodeURIComponent(id)} />;
}
