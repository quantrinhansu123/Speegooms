import { CrmShell } from "@/features/crm/crm-shell";

export default function SaleVnLayout({ children }: { children: React.ReactNode }) {
  return <CrmShell>{children}</CrmShell>;
}
