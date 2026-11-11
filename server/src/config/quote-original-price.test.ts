import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Request } from "express";
import type { AddressInfo } from "node:net";
import { canAccessQuoteDesk, canEditQuoteDesk, canViewQuoteOriginalPrice, defaultQuoteBank, emptyQuoteFreight, logisticsOrderFromSourcing, quoteOrderSchema, updateQuoteSchema, type Role } from "@speego/shared";
import { protectQuoteOriginalPrices } from "../middlewares/quote-original-price";
import { preserveQuotePrices, quoteDeskPatch } from "../services/quote-edit-policy";
import type { QuoteRecord } from "../repositories/crm.repository";

const order = quoteOrderSchema.parse({ id: "00000000-0000-4000-8000-000000000001", name: "Goods", selected: true, currency: "VND",
  lines: [{ stt: "1", productName: "Goods", quantity: 2, pricePerSet: 100, originalPrice: 70, lineTotal: 200, weightKg: 5, spec: "", note: "" }] });
const input = updateQuoteSchema.parse({ templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO", orders: [order], bank: defaultQuoteBank,
  notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [], freight: { ...emptyQuoteFreight, originalPrice: 55 }, logisticsFees: [{ label: "Fee", value: "10", originalPrice: 6 }] } });

test("original prices are nonnegative optional amounts and accounting only reads quote desks", () => {
  for (const value of [-1, Infinity, 1_000_000_001]) {
    assert.equal(quoteOrderSchema.safeParse({ ...order, lines: [{ ...order.lines[0], originalPrice: value }] }).success, false);
  }
  for (const role of ["admin", "sourcing", "logistics", "van-hanh", "ke-toan"] as const) assert.equal(canViewQuoteOriginalPrice(role), true);
  for (const role of ["sale-vn", "sale-global", "ban-gd", "marketing", "sale-intern"] as const) assert.equal(canViewQuoteOriginalPrice(role), false);
  for (const desk of ["sourcing", "logistics"] as const) {
    assert.equal(canAccessQuoteDesk("ke-toan", desk), true);
    assert.equal(canEditQuoteDesk("ke-toan", desk), false);
  }
});

test("Sale saves preserve original prices including insured Logistics; new rows cannot set them", () => {
  const forged = { ...input, orders: [{ ...order, lines: [{ ...order.lines[0], originalPrice: 1 }] }] };
  for (const insurance of [false, true]) {
    const current = { ...input, customerKind: insurance ? "LOGISTICS" : "SOURCING", orders: [{ ...order, insurance }] } as unknown as QuoteRecord;
    const saved = preserveQuotePrices(current, { ...forged, orders: [{ ...forged.orders[0], insurance }] });
    assert.equal(saved.orders[0].lines[0].originalPrice, 70);
    assert.equal(saved.notes.freight.originalPrice, 55);
    assert.equal(saved.notes.logisticsFees[0].originalPrice, 6);
  }
  const saved = preserveQuotePrices({ ...input, orders: [], customerKind: "SOURCING" } as unknown as QuoteRecord, forged);
  assert.equal(saved.orders[0].lines[0].originalPrice, null);
});

test("handoff keeps each desk's original price independent and Logistics saves its own cost", () => {
  assert.equal(logisticsOrderFromSourcing(order).lines[0].originalPrice, null);
  const previous = { ...order, lines: [{ ...order.lines[0], originalPrice: 25 }] };
  assert.equal(logisticsOrderFromSourcing(order, previous).lines[0].originalPrice, 25);
  const saved = quoteDeskPatch("logistics", { ...input, customerKind: "LOGISTICS" } as unknown as QuoteRecord, { ...input, orders: [previous] });
  assert.equal(saved.orders[0].lines[0].originalPrice, 25);
});

test("HTTP boundary removes original prices from every nested snapshot and rejects forged input for unauthorized roles", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { role: req.headers["x-role"] as Role } as NonNullable<Request["user"]>; next(); });
  app.use(protectQuoteOriginalPrices);
  app.post("/", (req, res) => res.json({ received: req.body, orders: [order], sourcingContext: { order },
    logisticsSheet: input, logisticsQuote: { sentQuote: { order, notes: input.notes } }, sentQuote: { order, notes: input.notes } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    for (const role of ["sale-vn", "sale-global", "ban-gd", "admin", "sourcing", "logistics", "van-hanh", "ke-toan"] as const) {
      const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, { method: "POST", headers: { "content-type": "application/json", "x-role": role }, body: JSON.stringify({ originalPrice: 999, name: "Normal data" }) });
      const text = await res.text();
      assert.equal(text.includes('"originalPrice"'), canViewQuoteOriginalPrice(role));
      assert.ok(text.includes("Normal data"));
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
