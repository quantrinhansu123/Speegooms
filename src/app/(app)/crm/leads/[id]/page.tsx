import type { Metadata } from "next";
import { LeadDetail } from "@/features/crm/components/lead-detail";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Chi tiết lead" };

export const instant = false;

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <LeadDetail messId={decodeURIComponent(id)} />}</WithParams>;
}
