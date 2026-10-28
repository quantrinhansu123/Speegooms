import type { Metadata } from "next";
import { QuotationEditor } from "@/features/crm/components/quotation-editor";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Soạn báo giá" };

export const instant = false;

export default function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <QuotationEditor quoteId={decodeURIComponent(id)} />}</WithParams>;
}
