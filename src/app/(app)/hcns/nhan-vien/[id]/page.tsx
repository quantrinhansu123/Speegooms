import { EmployeeDetail } from "@/features/hrm/hrm-view";
import { WithParams } from "@/components/shared/with-params";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <WithParams params={params}>{({ id }) => <EmployeeDetail id={id} />}</WithParams>;
}
