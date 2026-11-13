import assert from "node:assert/strict";
import { test } from "node:test";
import type { QuoteOrder } from "@speego/shared";
import { orderSummary } from "./order-summary";

test("conversion reuses quantity without copying order metrics into profile notes", () => {
  const order = { lines: [{ productName: "Áo", quantity: 2, unit: "cái", weightKg: 3, packages: [{ count: 2, lengthCm: 10, widthCm: 20, heightCm: 30, actualKg: 4 }] }] } as QuoteOrder;
  assert.deepEqual(orderSummary(order), {
    quantityNote: "Áo: 2 cái",
  });
});
