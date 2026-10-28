import { CrmShell } from "@/features/crm/crm-shell";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <CrmShell>{children}</CrmShell>;
}
