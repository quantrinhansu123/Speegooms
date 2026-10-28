import { OpsShell } from "@/features/operations/ops-shell";

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return <OpsShell>{children}</OpsShell>;
}
