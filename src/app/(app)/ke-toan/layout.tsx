import { AccountingShell } from "@/features/accounting/accounting-shell";

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return <AccountingShell>{children}</AccountingShell>;
}
