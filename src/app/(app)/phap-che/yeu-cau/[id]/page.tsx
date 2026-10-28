import { LegalTicketDetail } from "@/features/legal/legal-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LegalTicketDetail id={id} />;
}
