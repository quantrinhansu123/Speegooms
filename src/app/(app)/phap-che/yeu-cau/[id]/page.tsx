import { LegalTicketDetail } from "@/features/legal/legal-view";
import { WithParams } from "@/components/shared/with-params";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <LegalTicketDetail id={id} />}</WithParams>;
}
