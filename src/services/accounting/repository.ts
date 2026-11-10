import { createLocalRepository } from "@/services/repository-factory";
import type { AccountingSnapshot } from "@/types/accounting";

/** Không còn dữ liệu demo kế toán; bản gốc để chạy bộ check nằm ở services/accounting/fixtures. */
export const localAccountingRepository = createLocalRepository<AccountingSnapshot>("speego_accounting_demo_v2", async () => ({
  statement_lines: [],
  customer_receipts: [],
  payments: [],
  settlements: [],
}));
