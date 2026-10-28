import type { Metadata } from "next";
import { QuotationEditor } from "@/features/crm/components/quotation-editor";

export const metadata: Metadata = { title: "Soạn báo giá" };

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuotationEditor quoteId={decodeURIComponent(id)} />;
}
