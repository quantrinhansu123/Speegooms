import { createLocalRepository } from "@/services/repository-factory";
import type { AccountingSnapshot } from "@/types/accounting";

export const localAccountingRepository = createLocalRepository<AccountingSnapshot>("speego_accounting_demo_v1", async () => {
  const [lines, receipts, payments, settlements] = await Promise.all([
    import("@/mocks/accounting/statement-lines.json"),
    import("@/mocks/accounting/customer-receipts.json"),
    import("@/mocks/accounting/payments.json"),
    import("@/mocks/accounting/settlements.json"),
  ]);
  return {
    statement_lines: lines.default,
    customer_receipts: receipts.default,
    payments: payments.default,
    settlements: settlements.default,
  };
});
