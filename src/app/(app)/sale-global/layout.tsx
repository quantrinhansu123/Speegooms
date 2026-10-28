import { CrmShell } from "@/features/crm/crm-shell";

export default function SaleGlobalLayout({ children }: { children: React.ReactNode }) {
  return <CrmShell>{children}</CrmShell>;
}
