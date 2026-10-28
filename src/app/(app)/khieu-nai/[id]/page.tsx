import { ComplaintDetail } from "@/features/complaints/complaints-view";
import { WithParams } from "@/components/shared/with-params";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <ComplaintDetail id={id} />}</WithParams>;
}
