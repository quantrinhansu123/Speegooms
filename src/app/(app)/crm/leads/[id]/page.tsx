import type { Metadata } from "next";
import { LeadDetail } from "@/features/crm/components/lead-detail";

export const metadata: Metadata = { title: "Chi tiết lead" };

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetail messId={decodeURIComponent(id)} />;
}
