import assert from "node:assert/strict";
import test from "node:test";
import { contractAgentCost } from "../services/contract-cost";
import type { QuoteRecord } from "../repositories/crm.repository";

test("giá gốc hợp đồng = tổng giá gốc × số lượng, bỏ dòng thiếu giá", () => {
  const line = (originalPrice: number | undefined, quantity: number) => ({ basis: "unit", quantity, originalPrice, weightKg: null, cbm: null, areaM2: null });
  const quote = { customerKind: "SOURCING", logisticsSheet: null, orders: [{ selected: true, currency: "USD", lines: [line(10, 3), line(5, 2), line(undefined, 9)] }] } as unknown as QuoteRecord;
  assert.deepEqual(contractAgentCost(quote), [{ label: "Giá gốc hàng", currency: "USD", amount: 40 }]);
  assert.deepEqual(contractAgentCost(null), []);
});
