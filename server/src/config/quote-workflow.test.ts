import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canViewQuote, convertMessageSchema, customerKindSchema, isCombinedSourcing,
  quoteAccessKind, quoteNotifyRoles,
} from "@speego/shared";
import type pg from "pg";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { CrmService } from "../services/crm.service";
import { preserveQuotePrices, quoteDeskPatch } from "../services/quote-edit-policy";
import { accountingContractSchema, createContractSchema, createMessageSchema, contractPaymentFlags, fclChargeTotal, fclTotals, paymentsInMain, productAmounts, quoteAmount, quoteVndAmount, remainderAfterPayments, remainderByCurrency, shippingAmount, shippingInCurrency, sumByCurrency, totalsInMain } from "@speego/shared";
import type { CrmRepository, QuoteRecord } from "../repositories/crm.repository";
import type { NotificationService } from "../services/notification.service";
import { defaultQuoteBank, logisticsOrderFromSourcing, updateMessageSchema, updatePotentialSchema, updateQuoteSchema, withInsuranceCurrency, type PublicUser, type QuoteDesk } from "@speego/shared";
import { orderPackageMetrics } from "../../../src/services/crm/quote-lines";

test("conversion requires complete potential information, including logistics fields", () => {
  const base = { phone: "0123456789", brand: "LOGISTICS", customerType: "INDIVIDUAL", careChannel: "FACEBOOK", productInterest: "Hàng", quantityNote: "1", address: "Địa chỉ", saleNote: "Ghi chú", requirements: "Đơn hàng" };
  for (const reason of [undefined, "", "   ", "Khách cần mua hàng"]) {
    const result = convertMessageSchema.parse({ ...base, reason });
    assert.equal(result.reason, reason?.trim() ?? "");
  }
  assert.equal(convertMessageSchema.safeParse({ ...base, requirements: " " }).success, false);
  assert.equal(convertMessageSchema.safeParse({ ...base, quantityNote: " " }).success, true);
  assert.equal(customerKindSchema.safeParse("SOURCING_LOGISTICS").success, false);
  assert.equal(convertMessageSchema.safeParse({ ...base, shippingMode: "SEA" }).success, false);
  assert.equal(convertMessageSchema.safeParse({ ...base, shippingMode: "SEA", logisticsClass: "FCL", weightKg: "20", shipToAddress: "Địa chỉ", reason: "Có nhu cầu" }).success, true);
});

test("CRM keeps international phone formatting on message creation, editing, conversion and profile updates", () => {
  const message = { customerName: "Khách", email: "", goods: "Hàng", note: "Ghi chú", market: "Mỹ", saleName: "Sale", painPoint: "", linkMess: "" };
  const conversion = { customerType: "INDIVIDUAL", careChannel: "ZALO", productInterest: "Hàng", address: "", saleNote: "Ghi chú", requirements: "Giao hàng" };
  const potential = { fullName: "Khách", companyName: "", email: "", productInterest: "Hàng", quantityNote: "", address: "", saleNote: "Ghi chú", potential: "POTENTIAL" };
  for (const phone of ["0346612345", "(+84)0346612345", "+1 (234) 567-8900", "(+84) 034.661.2345"]) {
    assert.equal(createMessageSchema.parse({ ...message, phone }).phone, phone);
    assert.equal(updateMessageSchema.parse({ ...message, phone }).phone, phone);
    assert.equal(convertMessageSchema.parse({ ...conversion, phone }).phone, phone);
    assert.equal(updatePotentialSchema.parse({ ...potential, phone }).phone, phone);
  }
  for (const phone of ["phone", "(+84)abc", "+() -.", "123<script>", "1".repeat(31)]) {
    assert.equal(createMessageSchema.safeParse({ ...message, phone }).success, false);
    assert.equal(updateMessageSchema.safeParse({ ...message, phone }).success, false);
    assert.equal(convertMessageSchema.safeParse({ ...conversion, phone }).success, false);
    assert.equal(updatePotentialSchema.safeParse({ ...potential, phone }).success, false);
  }
  assert.equal(createMessageSchema.safeParse({ ...message, phone: "" }).success, true);
  assert.equal(convertMessageSchema.safeParse({ ...conversion, phone: "" }).success, false);
  assert.equal(updatePotentialSchema.safeParse({ ...potential, phone: "" }).success, false);
});

test("conversion defers weight and dimensions to the order or FCL form", () => {
  const base = { phone: "(+84)0346612345", customerType: "INDIVIDUAL", careChannel: "ZALO", productInterest: "Hàng", quantityNote: "1 kiện", address: "", saleNote: "Ghi chú", requirements: "Giao hàng", shipToAddress: "US", reason: "Cần gửi" };
  for (const routing of [{ shippingMode: "AIR" }, { shippingMode: "SEA", logisticsClass: "LCL" }, { shippingMode: "SEA", logisticsClass: "FCL" }]) {
    assert.equal(convertMessageSchema.safeParse({ ...base, ...routing }).success, true);
    assert.equal(convertMessageSchema.safeParse({ ...base, ...routing, weightKg: "", packageDimensions: "" }).success, true);
    for (const field of ["quantityNote", "shipToAddress", "reason", "requirements"] as const) {
      assert.equal(convertMessageSchema.safeParse({ ...base, ...routing, [field]: "" }).success, false);
    }
  }
});

test("FCL charges include VAT and optional trucking only in the full total", () => {
  const charges = [
    { name: "Ocean Freight", rate: 7000, quantity: 1, unit: "cont 40'", vatAmount: 0, note: "", optional: false },
    { name: "Trucking US", rate: 1100, quantity: 1, unit: "cont 40'", vatAmount: 8, note: "", optional: true },
  ];
  assert.equal(fclChargeTotal(charges[1]), 1108);
  assert.deepEqual(fclTotals(charges), { base: 7000, all: 8108 });
  const quote = handoffInput();
  quote.notes.fcl = { to: "Customer", pol: "Yantian", pod: "LAX", etd: "", weight: "12 tons", volume: "1x40HC", commodity: "Furniture", stuffingDate: "", charges, notes: "" };
  assert.deepEqual(quoteAmount({ ...quote, shippingMode: "SEA", logisticsClass: "FCL" }, "logistics"), { amount: 8108, currency: "USD", rate: null });
  assert.deepEqual(shippingAmount({ ...quote, shippingMode: "SEA", logisticsClass: "FCL" }), { amount: 8108, currency: "USD" });
});

test("combined sourcing routes viewing and notifications to the correct desk", () => {
  const combined = { customerKind: "SOURCING", quoteWorkflow: "COMBINED" as const };
  const legacy = { ...combined, quoteWorkflow: "LEGACY" as const };
  assert.equal(isCombinedSourcing(combined), true);
  assert.equal(isCombinedSourcing(legacy), false);
  assert.equal(isCombinedSourcing({ ...combined, customerKind: "LOGISTICS" }), false);
  assert.equal(canViewQuote("logistics", "sourcing", quoteAccessKind(combined)), false);
  assert.equal(canViewQuote("logistics", "logistics", quoteAccessKind(combined)), true);
  assert.equal(canViewQuote("logistics", "sourcing", quoteAccessKind(legacy)), true);
  assert.equal(quoteNotifyRoles("sourcing", quoteAccessKind(combined)).includes("logistics"), false);
  assert.equal(quoteNotifyRoles("logistics", quoteAccessKind(combined)).includes("logistics"), true);
});

test("Sale's request goes to Sourcing only: no Logistics sheet is created on either lane or workflow", async () => {
  for (const lane of ["vn", "global"] as const) {
    for (const workflow of ["LEGACY", "COMBINED"] as const) {
      const statements: string[] = [];
      const repository = new PostgresCrmRepository({
        query: async (sql: string) => {
          statements.push(sql);
          if (sql.includes("select nhom_khach")) return { rowCount: 1, rows: [{ customer_kind: "SOURCING", quote_workflow: workflow }] };
          if (sql.includes("select q.id")) return { rowCount: 1, rows: [{ customer_kind: "SOURCING", quote_workflow: workflow, created_at: new Date() }] };
          return { rowCount: 1, rows: [] };
        },
      } as unknown as pg.Pool);
      await repository.requestQuote(lane, "00000000-0000-0000-0000-000000000001");
      assert.equal(statements.some((sql) => sql.includes("bao_gia_logistics =")), false);
      assert.equal(statements.some((sql) => sql.includes("set luong_bao_gia")), false);
    }
  }
});

test("Logistics SQL scope separates legacy sourcing from combined sourcing", async () => {
  const statements: { sql: string; values: unknown[] }[] = [];
  const repository = new PostgresCrmRepository({
    query: async (sql: string, values: unknown[]) => {
      statements.push({ sql, values });
      return { rowCount: 0, rows: [] };
    },
  } as unknown as pg.Pool);
  const search = { q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "SOURCING" };
  await repository.listQuotes("vn", "sourcing", search, ["SOURCING"]);
  assert.match(statements[0].sql, /case when.*luong_bao_gia = 'COMBINED'/);
  assert.match(statements[0].sql, /any\(\$2::text\[\]\)/);
  assert.deepEqual(statements[0].values, ["SOURCING", ["SOURCING"]]);
  statements.length = 0;
  await repository.listQuotes("global", "logistics", search, ["LOGISTICS", "SOURCING_LOGISTICS"]);
  assert.ok(statements.some(({ sql }) => sql.includes("l.luong_bao_gia = 'COMBINED'")));
});

test("quote projection preserves both workflow and Sale requirement images after merging", async () => {
  for (const lane of ["vn", "global"] as const) {
    const repository = new PostgresCrmRepository({
      query: async (sql: string) => {
        assert.match(sql, /l\.luong_bao_gia as quote_workflow/);
        assert.match(sql, /l\.anh_yeu_cau as requirement_images/);
        assert.match(sql, /left join crm\.tin_nhan_(viet_nam|global) msg/);
        return { rowCount: 1, rows: [{
          id: "quote", customer_kind: "SOURCING", quote_workflow: "COMBINED",
          customer_type: "ENTERPRISE", brand: "SOURCING", potential: "POTENTIAL",
          requirements: "Giữ yêu cầu khách", requirement_images: ["https://example.com/requirement.png"],
          sale_note: "Giữ ghi chú Sale", mess_code: "MESS-1", link_mess: "https://example.com/message",
          created_at: new Date(),
        }] };
      },
    } as unknown as pg.Pool);
    const [quote] = await repository.listQuotes(lane, "sourcing", {
      q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "SOURCING",
    });
    assert.equal(isCombinedSourcing(quote), true);
    assert.equal(quote.customerType, "ENTERPRISE");
    assert.equal(quote.requirements, "Giữ yêu cầu khách");
    assert.deepEqual(quote.requirementImages, ["https://example.com/requirement.png"]);
    assert.equal(quote.saleNote, "Giữ ghi chú Sale");
    assert.equal(quote.messCode, "MESS-1");
    assert.equal(quote.linkMess, "https://example.com/message");
  }
});

test("creating a quote immediately notifies its desk once on either lane and workflow", async () => {
  for (const lane of ["vn", "global"] as const) {
    for (const customerKind of ["SOURCING", "LOGISTICS"] as const) {
      for (const quoteWorkflow of ["LEGACY", "COMBINED"] as const) {
        const desk = customerKind === "LOGISTICS" ? "logistics" : "sourcing";
        const quote = { id: "quote", code: "BG-1", customerKind, quoteWorkflow } as QuoteRecord;
        const actor = { id: "sale", name: "Sale", role: lane === "vn" ? "sale-vn" : "sale-global" } as PublicUser;
        let created = true;
        const calls: unknown[][] = [];
        const service = new CrmService({
          requestQuote: async () => {
            const result = { quote, created, desk };
            created = false;
            return result;
          },
        } as unknown as CrmRepository, {
          notifyQuoteRequested: async (...args: unknown[]) => { calls.push(args); },
        } as unknown as NotificationService);
        assert.equal((await service.requestQuote(lane, "customer", actor)).created, true);
        assert.deepEqual(calls, [[actor, lane, desk, quote.code, quote.id, quoteAccessKind(quote)]]);
        assert.equal((await service.requestQuote(lane, "customer", actor)).created, false);
        assert.equal(calls.length, 1, "opening an existing quote must not notify again");
      }
    }
  }
});

test("quote requests without an actor and invalid requests do not notify", async () => {
  let calls = 0;
  for (const result of ["missing", "kind", { quote: { id: "quote" }, created: true, desk: "sourcing" }] as const) {
    const service = new CrmService({
      requestQuote: async () => result,
    } as unknown as CrmRepository, {
      notifyQuoteRequested: async () => { calls += 1; },
    } as unknown as NotificationService);
    if (typeof result === "string") {
      await assert.rejects(service.requestQuote("vn", "customer", { role: "sale-vn" } as PublicUser));
    } else {
      await service.requestQuote("vn", "customer");
    }
  }
  assert.equal(calls, 0);
});

test("Sale can still hand a filled sourcing order to Sourcing", async () => {
  const desks: QuoteDesk[] = [];
  const quote = {
    id: "quote",
    code: "BGS",
    customerKind: "SOURCING",
    quoteWorkflow: "SOURCING",
    orders: [{ lines: [{ productName: "Gạch", quantity: 2 }] }],
  } as unknown as QuoteRecord;
  const service = new CrmService({
    requestQuote: async () => ({ quote, created: true, desk: "sourcing" }),
    findQuote: async () => quote,
  } as unknown as CrmRepository, {
    notifyQuoteRequested: async (_actor: PublicUser, _lane: string, desk: QuoteDesk) => { desks.push(desk); },
  } as unknown as NotificationService);
  await service.handoffSourcingOrder("vn", "quote", { role: "sale-vn" } as PublicUser);
  assert.deepEqual(desks, ["sourcing"]);
});

const messageInput = {
  customerName: "Khách", phone: "0900000000", email: "", goods: "Gạch", note: "", market: "Mỹ", saleName: "Sale", painPoint: "Cần tư vấn",
  linkMess: "", demand: "SOURCING" as const,
};
const messageOrder = {
  id: "00000000-0000-4000-8000-000000000009", name: "Gạch", selected: true, currency: "VND" as const, rate: null, priceColumns: [],
  lines: [{ stt: "1", productName: "Gạch men", quantity: 100, pricePerSet: null, lineTotal: null, weightKg: null, unit: "m2", spec: "", note: "" }],
};

test("only Sale and Admin can save the product draft on a mess", async () => {
  const seen: unknown[] = [];
  const service = new CrmService({
    createMessage: async (_lane: string, input: { order?: unknown }) => { seen.push(input.order); return {} as never; },
    updateMessage: async (_lane: string, _id: string, input: { order?: unknown }) => { seen.push(input.order); return {} as never; },
  } as unknown as CrmRepository);
  const input = createMessageSchema.parse({ ...messageInput, order: messageOrder });
  await service.createMessage("vn", input, "marketing");
  await service.updateMessage("vn", "id", input, "marketing");
  assert.deepEqual(seen, [undefined, undefined]);
  seen.length = 0;
  for (const role of ["sale-vn", "sale-global", "admin"] as const) await service.createMessage("vn", input, role);
  assert.equal(seen.length, 3);
  assert.ok(seen.every((order) => (order as unknown as { name: string }).name === "Gạch"));
});

test("message product draft is saved, kept on edits without it, and cleared explicitly", async () => {
  const calls: { sql: string; values: unknown[] }[] = [];
  const row = {
    id: "message", mess_code: "MESS-1", source: "OG", customer_name_raw: "Khách", phone: null, email: null, status: "NEW", goods: null,
    industry: null, demand: "SOURCING", customer_type: null, note: null, market: null, classification: null, sale_name: null,
    pain_point: "Cần tư vấn", link_mess: null, order_info: messageOrder, received_at: new Date(), lead_id: null, lead_code: null,
  };
  const pool = {
    query: async (sql: string, values: unknown[]) => {
      calls.push({ sql, values });
      if (sql.includes("insert into crm.tin_nhan") || sql.includes("update crm.tin_nhan")) return { rowCount: 1, rows: [{ id: "message" }] };
      if (sql.includes("select m.id")) return { rowCount: 1, rows: [row] };
      return { rowCount: 0, rows: [] };
    },
    connect: async () => ({ query: pool.query, release() {} }),
  };
  const repository = new PostgresCrmRepository(pool as unknown as pg.Pool);
  const created = await repository.createMessage("vn", createMessageSchema.parse({ ...messageInput, order: messageOrder }));
  assert.equal(created.order?.lines[0]?.productName, "Gạch men");
  const insert = calls.find((call) => call.sql.includes("insert into crm.tin_nhan"));
  assert.equal(JSON.parse(String(insert?.values[14])).name, "Gạch");

  calls.length = 0;
  await repository.updateMessage("vn", "message", updateMessageSchema.parse(messageInput));
  let update = calls.find((call) => call.sql.includes("update crm.tin_nhan"));
  assert.equal(update?.values[15], false);

  calls.length = 0;
  await repository.updateMessage("vn", "message", updateMessageSchema.parse({ ...messageInput, order: null }));
  update = calls.find((call) => call.sql.includes("update crm.tin_nhan"));
  assert.deepEqual([update?.values[15], update?.values[16]], [true, null]);
});

test("message edits load current quote products without exposing operation prices", async () => {
  const order = { ...messageOrder, rate: 25000, priceColumns: [{ currency: "USD" }],
    lines: [{ ...messageOrder.lines[0], productName: "Current product", weightKg: 25, quantity: 2, pricePerSet: 12 }] };
  const repository = new PostgresCrmRepository({
    query: async () => ({ rows: [{ received_at: new Date(), order_info: messageOrder, order_lines: [order] }] }),
  } as unknown as pg.Pool);
  const [message] = await repository.listMessages("global", { q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "", market: "" });
  assert.equal(message.order?.lines[0].productName, "Current product");
  assert.equal(message.order?.lines[0].pricePerSet, null);
  assert.deepEqual(message.order?.priceColumns, []);
  assert.equal(message.order?.rate, null);
  assert.equal(orderPackageMetrics(message.order!.lines, "SEA").chargeableKg, 50);
});

test("saving message products updates the linked quote atomically and preserves pricing and other options", async () => {
  for (const lane of ["vn", "global"] as const) {
    for (const desk of ["sourcing", "logistics"] as const) {
      for (const action of ["edit", "new", "clear", "omit", "failure"] as const) {
        const calls: { sql: string; values: unknown[] }[] = [];
        const current = createMessageSchema.parse({ ...messageInput, order: { ...messageOrder,
          lines: [{ ...messageOrder.lines[0], weightKg: 0, quantity: 2, pricePerSet: 12 }] } }).order!;
        const other = { ...current, id: "00000000-0000-4000-8000-000000000010", selected: false };
        const suffix = lane === "vn" ? "viet_nam" : "global";
        const table = `crm.bao_gia_${desk}_${suffix}`;
        const pool = {
          query: async (sql: string, values: unknown[] = []) => {
            calls.push({ sql, values });
            if (sql.includes("for update of q") && sql.includes(`from ${table} q`)) return { rows: [{
              id: "quote", customer_kind: desk === "sourcing" ? "SOURCING" : "LOGISTICS", quote_workflow: "SOURCING",
              order_lines: action === "new" ? [] : [current, other], created_at: new Date(),
              quote_status: "CHUA_CO_BAO_GIA", contract_status: "CHUA_TAO",
            }] };
            if (sql.startsWith(`update ${table}`) && action === "failure") throw new Error("quote write failed");
            if (sql.includes("select m.id")) return { rows: [{ received_at: new Date(), order_info: current }] };
            if (sql.includes(`update crm.tin_nhan_${suffix}`)) return { rows: [{ id: "message" }] };
            return { rows: [], rowCount: 0 };
          },
          connect: async () => ({ query: pool.query, release() {} }),
        };
        const repo = new PostgresCrmRepository(pool as unknown as pg.Pool);
        const input = updateMessageSchema.parse({ ...messageInput, order: action === "omit" ? undefined : action === "clear" ? null : {
          ...current, lines: [{ ...current.lines[0], productName: "Updated product", weightKg: 25, pricePerSet: 999 }],
        } });
        if (action === "failure") {
          await assert.rejects(repo.updateMessage(lane, "message", input));
          assert.equal(calls.at(-1)?.sql, "rollback");
          assert.ok(!calls.some((call) => call.sql === "commit"));
          continue;
        }
        await repo.updateMessage(lane, "message", input);
        assert.equal(calls[0].sql, "begin");
        assert.equal(calls.at(-1)?.sql, "commit");
        const writes = calls.filter((call) => call.sql.startsWith("update crm.bao_gia_"));
        if (action === "omit") { assert.equal(writes.length, 0); continue; }
        assert.equal(writes.length, 1);
        assert.equal(writes[0].sql, `update ${table} set chi_tiet_don_hang = $2::jsonb where id = $1::uuid`);
        const orders = JSON.parse(String(writes[0].values[1]));
        if (action === "clear") { assert.deepEqual(orders, [other]); continue; }
        assert.equal(orders[0].lines[0].productName, "Updated product");
        assert.equal(orders[0].lines[0].pricePerSet, action === "new" ? null : 12);
        assert.equal(orderPackageMetrics(orders[0].lines, "SEA").chargeableKg, 50);
        if (action === "edit") assert.deepEqual(orders[1], other);
      }
    }
  }
});

test("Sale content updates preserve Logistics packaging for the new workflow", async () => {
  const input = updateQuoteSchema.parse({
    templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
    orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "Order", selected: true, currency: "VND", rate: null,
      lines: [{ stt: "1", quantity: 1, pricePerSet: null, lineTotal: null, weightKg: null, unit: "set", spec: "", note: "" }] }],
    notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [] }, bank: defaultQuoteBank,
  });
  const packages = [{ count: 2, lengthCm: 20, widthCm: 30, heightCm: 40, actualKg: 5 }];
  const current = { ...input, id: "quote", customerKind: "SOURCING", quoteWorkflow: "COMBINED",
    orders: input.orders.map((order) => ({ ...order, lines: order.lines.map((line) => ({ ...line, packages, cbm: 0.048 })) })),
  } as QuoteRecord;
  const service = new CrmService({
    findQuote: async () => current,
    updateQuote: async (_lane: string, _desk: string, _id: string, patch: typeof input) => {
      assert.deepEqual(patch.orders[0].lines[0].packages, packages);
      assert.equal(patch.orders[0].lines[0].cbm, 0.048);
      return current;
    },
  } as unknown as CrmRepository);
  await service.updateQuote("vn", "logistics", "quote", input, { contentOnly: true, role: "sale-vn" });
});

const handoffInput = () => updateQuoteSchema.parse({
  templateId: null, opsNote: "Giao hàng dễ vỡ", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
  orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "Mẫu khách chọn", selected: true, currency: "VND", rate: null,
    lines: [{ stt: "1", image: "https://example.com/product.png", quantity: 12, pricePerSet: 500, lineTotal: 6000,
      weightKg: 20, cbm: 0.4, unit: "thùng", basis: "unit", spec: "Kích thước sản phẩm", note: "Không xếp chồng",
      attrs: [{ key: "Chất liệu", value: "Thủy tinh" }], packages: [] }] }],
  notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [] }, bank: defaultQuoteBank,
});

test("Sale enters insured Logistics values; Logistics owns currency and exchange rate", () => {
  const stored = handoffInput();
  const current = { ...stored, customerKind: "LOGISTICS" } as unknown as QuoteRecord;
  for (const insurance of [true, false]) {
    const input = structuredClone(stored);
    Object.assign(input.orders[0], { insurance, currency: "USD", rate: 25000 });
    Object.assign(input.orders[0].lines[0], { pricePerSet: 12, lineTotal: 144 });
    let saved = preserveQuotePrices(current, input);
    assert.equal(saved.orders[0].insurance, insurance);
    assert.equal(saved.orders[0].currency, "VND");
    assert.equal(saved.orders[0].rate, null);
    assert.equal(saved.orders[0].lines[0].pricePerSet, insurance ? 12 : 500);
    assert.equal(saved.orders[0].lines[0].lineTotal, insurance ? 144 : 6000);
    saved = preserveQuotePrices({ ...current, orders: [] }, input);
    assert.equal(saved.orders[0].currency, "VND");
    assert.equal(saved.orders[0].rate, null);
    assert.equal(saved.orders[0].lines[0].pricePerSet, insurance ? 12 : null);
    assert.equal(saved.orders[0].lines[0].lineTotal, insurance ? 144 : null);
    const sourcing = preserveQuotePrices({ ...current, customerKind: "SOURCING" }, input);
    assert.equal(sourcing.orders[0].lines[0].pricePerSet, 500);
  }
  current.orders[0].insurance = true;
  const input = structuredClone(stored);
  Object.assign(input.orders[0], { currency: "EUR", rate: 999 });
  Object.assign(input.orders[0].lines[0], { pricePerSet: 999, lineTotal: 9999 });
  Object.assign(input.notes.freight, { currency: "USD", vndRate: 25000 });
  const priced = quoteDeskPatch("logistics", current, input);
  assert.equal(priced.orders[0].insurance, true);
  assert.equal(priced.orders[0].currency, "USD");
  assert.equal(priced.orders[0].rate, 25000);
  assert.equal(priced.orders[0].lines[0].pricePerSet, 500);
  assert.equal(priced.orders[0].lines[0].lineTotal, 6000);
});

test("insured Logistics values survive reopening Mess from the linked quote on both lanes", async () => {
  for (const lane of ["vn", "global"] as const) {
    const order = { ...handoffInput().orders[0], insurance: true, currency: "USD", rate: 25000 };
    const repository = new PostgresCrmRepository({
      query: async () => ({ rows: [{ received_at: new Date(), demand: "SHIPPING", order_lines: [order] }] }),
    } as unknown as pg.Pool);
    const [message] = await repository.listMessages(lane, { q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "", market: "" });
    assert.equal(message.order?.insurance, true);
    assert.equal(message.order?.currency, "USD");
    assert.equal(message.order?.rate, 25000);
    assert.equal(message.order?.lines[0].pricePerSet, 500);
    assert.equal(message.order?.lines[0].lineTotal, 6000);
  }
});

test("insured pure Logistics shares freight currency and VND rate while other orders stay unchanged", () => {
  const input = handoffInput();
  input.orders[0].insurance = true;
  const source = { customerKind: "LOGISTICS", shippingMode: "AIR", logisticsClass: null as string | null, notes: input.notes };
  Object.assign(input.notes.freight, { currency: "USD", vndRate: 25000 });
  let order = withInsuranceCurrency(input.orders, source)[0];
  assert.equal(order.currency, "USD");
  assert.equal(order.rate, 25000);
  assert.equal(order.lines[0].pricePerSet, 500);
  assert.equal(order.lines[0].lineTotal, 6000);
  input.notes.freight.currency = "VND";
  order = withInsuranceCurrency(input.orders, source)[0];
  assert.equal(order.currency, "VND");
  assert.equal(order.rate, null);
  input.notes.payment = { quoteCurrency: "AUD", currency: "AUD", exchangeRate: null };
  order = withInsuranceCurrency(input.orders, { ...source, shippingMode: "SEA", logisticsClass: "FCL" })[0];
  assert.equal(order.currency, "AUD");
  assert.equal(order.rate, 25000);
  assert.equal(withInsuranceCurrency(input.orders, { ...source, customerKind: "SOURCING" }), input.orders);
  input.orders[0].insurance = false;
  assert.equal(withInsuranceCurrency(input.orders, source)[0], input.orders[0]);
});

test("FCL shipment edits from Sale preserve Logistics charges", async () => {
  const stored = handoffInput();
  const fcl = { to: "Customer", pol: "Yantian", pod: "LAX", etd: "", weight: "12 tons", volume: "1x40HC", commodity: "Furniture", stuffingDate: "", charges: [{ name: "Ocean Freight", rate: 7000, quantity: 1, unit: "cont", vatAmount: 0, note: "", optional: false }], notes: "" };
  stored.notes.fcl = fcl;
  const submitted = structuredClone(stored);
  submitted.notes.fcl!.pol = "Shanghai";
  submitted.notes.fcl!.charges[0].rate = 1;
  const current = { ...stored, id: "quote", customerKind: "LOGISTICS", shippingMode: "SEA", logisticsClass: "FCL", quoteWorkflow: "LEGACY" } as QuoteRecord;
  const service = new CrmService({
    findQuote: async () => current,
    updateQuote: async (_lane: string, _desk: string, _id: string, patch: typeof stored) => {
      assert.equal(patch.notes.fcl?.pol, "Shanghai");
      assert.deepEqual(patch.notes.fcl?.charges, fcl.charges);
      return current;
    },
  } as unknown as CrmRepository);
  await service.updateQuote("vn", "logistics", "quote", submitted, { contentOnly: true, role: "sale-vn" });
});

test("Sale order content on a pure logistics customer keeps the prices set by Logistics and the logistics fees", async () => {
  const packages = [{ count: 2, lengthCm: 20, widthCm: 30, heightCm: 40, actualKg: 5 }];
  const stored = handoffInput();
  stored.orders[0].lines[0].pricePerSet = 900;
  stored.orders[0].lines[0].lineTotal = 10800;
  stored.notes.logisticsFees = [{ label: "Vận chuyển", labelEn: "", value: "500.000", currency: "", itemStt: "" }];
  const submitted = structuredClone(stored);
  submitted.orders[0].currency = "USD";
  submitted.orders[0].rate = 25000;
  submitted.orders[0].lines[0].quantity = 8;
  submitted.orders[0].lines[0].pricePerSet = 12;
  submitted.orders[0].lines[0].lineTotal = 96;
  submitted.orders[0].lines[0].spec = "Sale cập nhật thông số";
  submitted.orders[0].lines[0].packages = packages;
  submitted.notes.logisticsFees = [{ label: "Vận chuyển", labelEn: "", value: "1", currency: "", itemStt: "" }];
  submitted.notes.totalLabel = "1.000.000";
  submitted.notes.validityNote = "30 ngày";
  submitted.notes.deposit = ["30%"];
  submitted.notes.weightNote = "120 kg / 2.4 CBM";
  const current = { ...stored, id: "quote", customerKind: "LOGISTICS", quoteWorkflow: "LEGACY" } as QuoteRecord;
  const service = new CrmService({
    findQuote: async () => current,
    updateQuote: async (_lane: string, _desk: string, _id: string, patch: typeof stored) => {
      assert.equal(patch.orders[0].lines[0].quantity, 8);
      assert.equal(patch.orders[0].lines[0].spec, "Sale cập nhật thông số");
      assert.deepEqual(patch.orders[0].lines[0].packages, packages);
      assert.equal(patch.orders[0].currency, stored.orders[0].currency);
      assert.equal(patch.orders[0].rate, stored.orders[0].rate);
      assert.equal(patch.orders[0].lines[0].pricePerSet, 900);
      assert.equal(patch.orders[0].lines[0].lineTotal, 10800);
      assert.deepEqual(patch.notes.logisticsFees, stored.notes.logisticsFees);
      assert.equal(patch.notes.totalLabel, "1.000.000");
      assert.equal(patch.notes.validityNote, "30 ngày");
      assert.deepEqual(patch.notes.deposit, ["30%"]);
      assert.equal(patch.notes.weightNote, "120 kg / 2.4 CBM");
      return current;
    },
  } as unknown as CrmRepository);
  await service.updateQuote("vn", "logistics", "quote", submitted, { contentOnly: true, role: "sale-vn" });
});

test("Pure logistics keeps packaging even when the lead workflow is combined", async () => {
  const packages = [{ count: 2, lengthCm: 20, widthCm: 30, heightCm: 40, actualKg: 5 }];
  const stored = handoffInput();
  const submitted = structuredClone(stored);
  submitted.orders[0].lines[0].packages = packages;
  submitted.orders[0].lines[0].cbm = 0.048;
  submitted.orders[0].lines[0].weightKg = 10;
  const current = { ...stored, id: "quote", customerKind: "LOGISTICS", quoteWorkflow: "COMBINED" } as QuoteRecord;
  const service = new CrmService({
    findQuote: async () => current,
    updateQuote: async (_lane: string, _desk: string, _id: string, patch: typeof stored) => {
      assert.deepEqual(patch.orders[0].lines[0].packages, packages);
      assert.equal(patch.orders[0].lines[0].cbm, 0.048);
      assert.equal(patch.orders[0].lines[0].weightKg, 10);
      return current;
    },
  } as unknown as CrmRepository);
  await service.updateQuote("vn", "logistics", "quote", submitted, { contentOnly: true, role: "admin" });
});

test("Admin save on a pure logistics quote keeps the order and the logistics fees", async () => {
  const stored = handoffInput();
  stored.orders[0].lines[0].pricePerSet = 900;
  stored.orders[0].lines[0].lineTotal = 10800;
  stored.notes.logisticsFees = [{ label: "Vận chuyển", labelEn: "", value: "500.000", currency: "", itemStt: "" }];
  const submitted = structuredClone(stored);
  submitted.orders[0].lines[0].quantity = 8;
  submitted.orders[0].lines[0].spec = "Sale cập nhật thông số";
  submitted.orders[0].lines[0].pricePerSet = 1;
  submitted.notes.logisticsFees = [{ label: "Cước biển", labelEn: "", value: "700.000", currency: "", itemStt: "" }];
  submitted.notes.shippingLabel = "700.000";
  const current = { ...stored, id: "quote", customerKind: "LOGISTICS", quoteWorkflow: "LEGACY" } as QuoteRecord;
  const service = new CrmService({
    findQuote: async () => current,
    updateQuote: async (_lane: string, _desk: string, _id: string, patch: typeof stored) => {
      assert.equal(patch.orders[0].lines[0].quantity, 8);
      assert.equal(patch.orders[0].lines[0].spec, "Sale cập nhật thông số");
      assert.equal(patch.orders[0].lines[0].pricePerSet, 900);
      assert.deepEqual(patch.notes.logisticsFees, submitted.notes.logisticsFees);
      assert.equal(patch.notes.shippingLabel, "700.000");
      return current;
    },
  } as unknown as CrmRepository);
  await service.updateQuote("vn", "logistics", "quote", submitted, { contentOnly: true, role: "admin" });
});

test("Admin full save on a pure logistics quote keeps the prices admin entered", async () => {
  const stored = handoffInput();
  stored.orders[0].lines[0].pricePerSet = 900;
  const submitted = structuredClone(stored);
  submitted.orders[0].lines[0].pricePerSet = 1;
  submitted.orders[0].lines[0].basis = "kg";
  const current = { ...stored, id: "quote", customerKind: "LOGISTICS", quoteWorkflow: "LEGACY" } as QuoteRecord;
  const service = new CrmService({
    findQuote: async () => current,
    updateQuote: async (_lane: string, _desk: string, _id: string, patch: typeof stored) => {
      assert.equal(patch.orders[0].lines[0].pricePerSet, 1);
      assert.equal(patch.orders[0].lines[0].basis, "kg");
      return current;
    },
  } as unknown as CrmRepository);
  await service.updateQuote("vn", "logistics", "quote", submitted, { contentOnly: false, role: "admin" });
});

test("Logistics prices a pure logistics order by unit, kg, m2 or CBM without touching Sale content", () => {
  const original = handoffInput();
  const pure = { ...original, customerKind: "LOGISTICS" } as QuoteRecord;
  const submitted = structuredClone(original);
  const line = submitted.orders[0].lines[0];
  line.basis = "m2";
  line.areaM2 = 8;
  line.weightKg = 40;
  line.cbm = 1.5;
  line.pricePerSet = 12.5;
  line.lineTotal = 100;
  line.quantity = 999;
  line.spec = "Logistics không được sửa";
  submitted.orders[0].currency = "CNY";
  const patch = quoteDeskPatch("logistics", pure, submitted);
  const saved = patch.orders[0].lines[0];
  assert.equal(saved.basis, "m2");
  assert.equal(saved.areaM2, 8);
  assert.equal(saved.weightKg, 40);
  assert.equal(saved.cbm, 1.5);
  assert.equal(saved.pricePerSet, 12.5);
  assert.equal(saved.lineTotal, 100);
  assert.equal(patch.orders[0].currency, "CNY");
  assert.equal(saved.quantity, 12);
  assert.equal(saved.spec, "Kích thước sản phẩm");
  // Khách không thuần logistics: số kg/m2/CBM vẫn là của Sale/Sourcing.
  const combined = quoteDeskPatch("logistics", { ...original, customerKind: "SOURCING" } as QuoteRecord, submitted).orders[0].lines[0];
  assert.equal(combined.areaM2, original.orders[0].lines[0].areaM2);
  assert.equal(combined.weightKg, original.orders[0].lines[0].weightKg);
  assert.equal(combined.basis, "m2");
});

test("Logistics can change costs and payment account, while Sourcing owns the order", () => {
  const original = handoffInput();
  const current = { ...original, orders: original.orders } as QuoteRecord;
  const submitted = structuredClone(original);
  submitted.orders[0].lines[0].quantity = 999;
  submitted.orders[0].lines[0].pricePerSet = 100000;
  submitted.orders[0].rate = 999;
  submitted.bank.accountName = "Changed";
  submitted.opsNote = "Changed";
  submitted.notes.weightNote = "Changed";
  submitted.notes.shippingLabel = "500 VND";
  submitted.notes.logisticsFees = [{ label: "Vận chuyển", labelEn: "", value: "500 VND", currency: "", itemStt: "" }];
  const costs = quoteDeskPatch("logistics", current, submitted);
  assert.equal(costs.orders[0].lines[0].quantity, 12);
  assert.equal(costs.orders[0].lines[0].spec, "Kích thước sản phẩm");
  assert.equal(costs.orders[0].lines[0].pricePerSet, 100000);
  assert.equal(costs.orders[0].rate, 999);
  assert.deepEqual(costs.bank, submitted.bank);
  assert.equal(costs.opsNote, "Changed");
  assert.equal(costs.notes.weightNote, original.notes.weightNote);
  assert.deepEqual(costs.notes.logisticsFees, submitted.notes.logisticsFees);
  assert.equal(costs.notes.shippingLabel, "500 VND");
  const order = quoteDeskPatch("sourcing", current, submitted);
  assert.equal(order.orders[0].lines[0].quantity, 999);
  assert.equal(order.orders[0].rate, 999);
  assert.deepEqual(order.notes.logisticsFees, original.notes.logisticsFees);
});

test("handoff carries product details without treating sourcing prices as shipping prices", () => {
  const source = handoffInput().orders[0];
  const before = structuredClone(source);
  const shipping = logisticsOrderFromSourcing(source);
  assert.equal(shipping.name, source.name);
  assert.equal(shipping.lines[0].quantity, 12);
  assert.equal(shipping.lines[0].unit, "thùng");
  assert.equal(shipping.lines[0].image, source.lines[0].image);
  assert.equal(shipping.lines[0].spec, source.lines[0].spec);
  assert.equal(shipping.lines[0].note, source.lines[0].note);
  assert.deepEqual(shipping.lines[0].attrs, source.lines[0].attrs);
  assert.equal(shipping.lines[0].weightKg, 20);
  assert.equal(shipping.lines[0].pricePerSet, null);
  assert.equal(shipping.lines[0].lineTotal, null);
  assert.deepEqual(source, before);
});

test("Sourcing send atomically includes a Logistics handoff on both lanes", async () => {
  for (const lane of ["vn", "global"] as const) {
    const input = handoffInput();
    let handoff: { orders: typeof input.orders } | undefined;
    const repository = new PostgresCrmRepository({
      query: async (sql: string, values: unknown[]) => {
        if (sql.trimStart().startsWith("update")) {
          assert.match(sql, /ban_da_gui = \$9::jsonb/);
          assert.match(sql, /bao_gia_logistics = jsonb_set\(case/);
          assert.match(sql, /'\{handoffAt\}'/);
          assert.match(sql, /else bao_gia_logistics end/);
          assert.match(sql, /bao_gia_logistics->>'sentQuote' is null/);
          handoff = JSON.parse(values[9] as string);
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 1, rows: [{ customer_kind: "SOURCING", quote_workflow: "COMBINED", created_at: new Date() }] };
      },
    } as unknown as pg.Pool);
    await repository.sendQuote(lane, "sourcing", "quote", input);
    assert.equal(handoff?.orders.length, 1);
    assert.ok((handoff as { handoffAt?: string } | undefined)?.handoffAt, "phiếu chuyển giao có dấu handoffAt");
    assert.equal(handoff?.orders[0].lines[0].quantity, 12);
    assert.equal(handoff?.orders[0].lines[0].pricePerSet, null);
  }
});

test("Logistics uses current Sourcing packaging while preserving shipping prices", async () => {
  const input = handoffInput();
  for (const existing of [false, true]) {
    const source = input.orders[0];
    const currentSource = structuredClone(source);
    currentSource.lines[0].packages = [{ count: 3, lengthCm: 100, widthCm: 100, heightCm: 80.4, actualKg: 40 }];
    const shipping = logisticsOrderFromSourcing(source);
    shipping.lines[0].pricePerSet = 77;
    shipping.lines[0].packages = [{ count: 1, lengthCm: 100, widthCm: 100, heightCm: 80, actualKg: 40 }];
    const repository = new PostgresCrmRepository({
      query: async (sql: string) => ({ rowCount: 1, rows: sql.includes("bao_gia_sourcing") ? [{
        customer_kind: "SOURCING", quote_workflow: "COMBINED", created_at: new Date(), ops_note: input.opsNote,
        sent_copy: { sentAt: new Date().toISOString(), order: source, notes: input.notes, bank: input.bank },
        order_lines: [currentSource],
        logistics_sheet: { ...input, orders: existing ? [shipping] : [], sentQuote: null },
      }] : [] }),
    } as unknown as pg.Pool);
    const quote = await repository.findQuote("vn", "logistics", "quote");
    assert.equal(quote?.sourcingContext?.order.lines[0].pricePerSet, 500);
    assert.deepEqual(quote?.sourcingContext?.order.lines[0].packages, currentSource.lines[0].packages);
    assert.equal(quote?.sourcingContext?.opsNote, "Giao hàng dễ vỡ");
    assert.equal(quote?.orders[0].lines[0].quantity, 12);
    assert.equal(quote?.orders[0].lines[0].pricePerSet, existing ? 77 : null);
    assert.deepEqual(quote?.orders[0].lines[0].packages, currentSource.lines[0].packages);
  }
});

test("Logistics follows edited, reordered and added Sourcing lines while retaining its prices", async () => {
  const input = handoffInput();
  const old = input.orders[0];
  const shipping = logisticsOrderFromSourcing(old);
  shipping.lines[0].pricePerSet = 77;
  const source = structuredClone(old);
  Object.assign(source.lines[0], { productName: "New goods", quantity: 24, spec: "New spec", note: "New note" });
  source.lines.unshift({ ...structuredClone(source.lines[0]), stt: "2", productName: "Added goods" });
  for (const lane of ["vn", "global"] as const) {
    const repository = new PostgresCrmRepository({ query: async (sql: string) => ({ rowCount: 1, rows: sql.includes("bao_gia_sourcing") ? [{
      customer_kind: "SOURCING", quote_workflow: "COMBINED", created_at: new Date(), order_lines: [source],
      logistics_sheet: { ...input, orders: [shipping], handoffAt: "test" },
    }] : [] }) } as unknown as pg.Pool);
    const quote = await repository.findQuote(lane, "logistics", "quote");
    assert.equal(quote?.orders[0].lines.length, 2);
    assert.equal(quote?.orders[0].lines[0].productName, "Added goods");
    assert.equal(quote?.orders[0].lines[0].pricePerSet, null);
    assert.equal(quote?.orders[0].lines[1].pricePerSet, 77);
    assert.equal(quote?.orders[0].lines[1].quantity, 24);
    assert.equal(quote?.orders[0].lines[1].spec, "New spec");
    assert.equal(quote?.orders[0].lines[1].note, "New note");
  }
  const removed = logisticsOrderFromSourcing({ ...source, lines: [] }, shipping);
  assert.deepEqual(removed.lines, []);
  assert.equal(logisticsOrderFromSourcing({ ...source, id: "new-order" }, shipping).lines[1].pricePerSet, null);
});

test("Sale notes survive a Sourcing content save without changing operating fees", () => {
  const input = handoffInput();
  const current = { ...input, customerKind: "SOURCING", quoteWorkflow: "COMBINED" } as QuoteRecord;
  const edited = structuredClone(input);
  edited.notes.weightNote = "25 kg";
  edited.notes.deposit = ["Deposit instruction"];
  edited.notes.freight.total = 999;
  const saved = preserveQuotePrices(current, edited);
  assert.equal(saved.notes.weightNote, "25 kg");
  assert.deepEqual(saved.notes.deposit, edited.notes.deposit);
  assert.deepEqual(saved.notes.freight, current.notes.freight);
});

test("FCL handoff validates the shipment form and manual kg can hand off without packages", async () => {
  const input = handoffInput();
  const current = { ...input, id: "quote", code: "BG", customerKind: "LOGISTICS", shippingMode: "SEA", logisticsClass: "FCL",
    orders: [], notes: { ...input.notes, fcl: { to: "", pol: "", pod: "", etd: "", stuffingDate: "", weight: "25 kg", volume: "1 x 40HC", commodity: "Clothes", charges: [], notes: "" } },
  } as unknown as QuoteRecord;
  const service = new CrmService({ findQuote: async () => current } as unknown as CrmRepository);
  const actor = { id: "sale", role: "sale-vn" } as PublicUser;
  assert.equal(await service.handoffLogisticsOrder("vn", "quote", actor), current);
  for (const field of ["commodity", "weight", "volume"] as const) {
    const value = current.notes.fcl![field];
    current.notes.fcl![field] = "";
    await assert.rejects(service.handoffLogisticsOrder("vn", "quote", actor), { status: 400 });
    current.notes.fcl![field] = value;
  }
  current.logisticsClass = "LCL";
  current.orders = input.orders;
  assert.equal(await service.handoffLogisticsOrder("vn", "quote", actor), current);
  current.orders[0].lines[0].weightKg = null;
  await assert.rejects(service.handoffLogisticsOrder("vn", "quote", actor), { status: 400 });
});

test("quote totals use costs, avoid double counting, and convert contract shipping explicitly", () => {
  const input = handoffInput();
  input.notes.logisticsFees = [{ label: "Cảng", labelEn: "", value: "1.000.000", currency: "", itemStt: "" }, { label: "Vận chuyển", labelEn: "", value: "500.000", currency: "", itemStt: "" }];
  assert.equal(quoteAmount(input, "sourcing").amount, 6000);
  assert.equal(quoteAmount(input, "logistics").amount, 1500000);
  assert.equal(quoteAmount(input, "logistics").currency, "VND");
  input.notes.shippingLabel = "2.000.000";
  assert.equal(quoteAmount(input, "logistics").amount, 1500000);
  assert.equal(shippingInCurrency(input, { currency: "USD", rate: 25000 }), 60);
  assert.equal(shippingInCurrency(input, { currency: "USD", rate: null }), null);
  input.notes.shippingLabel = "";
  input.notes.logisticsFees[0].value = "Chưa chốt";
  assert.equal(quoteAmount(input, "logistics").amount, null);
  assert.deepEqual(quoteAmount(input, "logistics").gaps, ["Cảng: Chưa chốt"]);
  input.notes.logisticsFees[0].value = "";
  assert.equal(quoteAmount(input, "logistics").amount, 500000);
});

test("logistics total keeps the fee currency when freight currency was left blank", () => {
  const order = {
    id: "00000000-0000-4000-8000-000000000001", name: "Pepe", selected: true, currency: "VND", rate: null,
    priceColumns: [{ currency: "USD", rate: 25769.0653 }], lines: [],
  };
  const notes = {
    ...handoffInput().notes,
    freight: { rate: 3.5, cbmRate: null, basis: "kg" as const, currency: "", total: 857.15, totalManual: false },
    logisticsFees: [{ label: "Phụ phí địa chỉ", labelEn: "", value: "36,", currency: "USD", itemStt: "" }],
  };
  const total = quoteAmount({ orders: [order], notes }, "logistics");
  assert.equal(total.currency, "USD");
  assert.equal(total.amount, 893.15);
  assert.equal(total.rate, 25769.0653);
  assert.equal(shippingInCurrency({ orders: [order], notes }, { currency: "VND", rate: null }), 23015640.67);
});

test("contract amounts keep only the entered currency, not rate-converted columns", () => {
  const order = {
    id: "00000000-0000-4000-8000-000000000001", name: "Pepe", selected: true, currency: "VND" as const, rate: null,
    priceColumns: [{ currency: "USD" as const, rate: 25769.0653 }],
    lines: [
      { lineTotal: 5242974, prices: [{ currency: "USD", lineTotal: 203.46 }] },
      { lineTotal: 8480084, prices: [{ currency: "USD", lineTotal: 329.08 }] },
      { lineTotal: 31458102, prices: [{ currency: "USD", lineTotal: 1220.77 }] },
    ],
  };
  const notes = {
    ...handoffInput().notes,
    freight: { rate: 3.5, cbmRate: null, basis: "kg" as const, currency: "", total: 857.15, totalManual: false },
    logisticsFees: [{ label: "Phụ phí địa chỉ", labelEn: "", value: "36,", currency: "USD", itemStt: "" }],
  };
  const product = productAmounts(order as never);
  const shipping = shippingAmount({ orders: [order as never], notes });
  assert.deepEqual(product, [{ currency: "VND", amount: 45181160 }]);
  assert.deepEqual(shipping, { currency: "USD", amount: 893.15 });
  const totals = sumByCurrency([product, shipping ? [shipping] : []]);
  assert.deepEqual(remainderByCurrency(totals, "VND", 2627), [
    { currency: "VND", amount: 45178533 },
    { currency: "USD", amount: 893.15 },
  ]);
  assert.deepEqual(remainderAfterPayments(totals, [{ currency: "VND", amount: 2363 }, { currency: "USD", amount: 264 }]), [
    { currency: "VND", amount: 45178797 },
    { currency: "USD", amount: 629.15 },
  ]);
});

test("accounting must enter a positive amount for every confirmation", () => {
  for (const amount of [undefined, null, 0, -1, Number.NaN]) {
    assert.equal(accountingContractSchema.safeParse({ accountingStatus: "DA_HOAN_THANH_COC", confirmations: [{ amount, note: "", images: [] }] }).success, false);
  }
  assert.equal(accountingContractSchema.safeParse({ accountingStatus: "DA_HOAN_THANH_COC", confirmations: [] }).success, false);
  assert.equal(accountingContractSchema.safeParse({ accountingStatus: "DA_HOAN_THANH_COC", confirmations: [{ amount: 500, note: "", images: [] }] }).success, true);
});

test("contract source desk survives every contract view on both lanes, including missing sources", async () => {
  for (const lane of ["vn", "global"] as const) {
    const suffix = lane === "vn" ? "viet_nam" : "global";
    for (const desk of ["sourcing", "logistics", null] as const) {
      const repository = new PostgresCrmRepository({
        query: async (sql: string) => {
          for (const source of ["sourcing", "logistics"]) {
            assert.ok(sql.includes(`from crm.bao_gia_${source}_${suffix} q where q.id = h.ma_bao_gia`));
          }
          return { rowCount: 1, rows: [{
            id: "contract", lane, quote_id: desk ? "quote" : null, quote_desk: desk,
            currency: "VND", created_at: new Date(), updated_at: new Date(),
          }] };
        },
      } as unknown as pg.Pool);
      for (const view of ["sale", "ops", "accounting"] as const) {
        const [contract] = await repository.listContracts(lane, false, view, { q: "", from: "", to: "", opsStatus: "", accountingStatus: "" });
        assert.equal(contract.quoteDesk, desk);
      }
    }
  }
});

test("both lanes show live payments and logistics details to Sale", async () => {
  for (const lane of ["vn", "global"] as const) {
    const raw = {
      id: "contract", lane, customer_name: "Tên khách đã sửa", currency: "VND", total_value: 1000, paid_amount: 500, balance: 500,
      confirmed_amount: 500, accounting_status: "DA_HOAN_THANH_COC", ops_status: "Đang vận chuyển", delivery_on: "2026-11-03",
      tracking: "TRACK-NEW", note_1: "Đã nhập kho", note_2: "Chờ container",
      china_warehouse_on: "2026-10-31", container_on: "2026-11-01", arrival_on: "2026-11-02",
      payments: [{ amount: 200, paidOn: "2026-10-30", note: "Lần 1", images: [] }, { amount: 300, paidOn: "2026-10-31", note: "Lần 2", images: [] }],
      sent_ops_body: { customerName: "Tên khách cũ", totalValue: 1000, paidAmount: 200, currency: "VND" },
      sent_accounting_body: { customerName: "Tên khách cũ", totalValue: 1000, paidAmount: 200, currency: "VND", deliveryOn: "2026-12-20" },
      sent_parties_body: { tracking: "TRACK-OLD", note1: "Cũ", deliveryOn: "2026-12-20" },
      created_at: new Date(), updated_at: new Date(),
    };
    const repository = new PostgresCrmRepository({ query: async () => ({ rowCount: 1, rows: [raw] }) } as unknown as pg.Pool);
    for (const view of ["sale", "ops", "accounting"] as const) {
      const [contract] = await repository.listContracts(lane, false, view, { q: "", from: "", to: "", opsStatus: "", accountingStatus: "" });
      assert.equal(contract.customerName, "Tên khách đã sửa");
      assert.deepEqual(contract.payments.map((line) => line.amount), [200, 300]);
      assert.equal(contract.paidAmount, 500);
      assert.equal(contract.deliveryOn, "2026-11-03");
      if (view === "sale") {
        assert.equal(contract.tracking, "TRACK-NEW");
        assert.equal(contract.note1, "Đã nhập kho");
        assert.equal(contract.note2, "Chờ container");
        assert.equal(contract.chinaWarehouseOn, "2026-10-31");
        assert.equal(contract.containerOn, "2026-11-01");
        assert.equal(contract.arrivalOn, "2026-11-02");
      }
      assert.equal(contractPaymentFlags({ ...contract, today: "2026-10-31" }).urgePayment, true);
    }
  }
});

test("explicit handoff notifies Logistics even when its draft already exists", async () => {
  let notified = false;
  const quote = { id: "quote", code: "BGS", customerKind: "SOURCING", quoteWorkflow: "COMBINED" };
  const service = new CrmService({ findQuote: async () => quote, requestLogisticsQuote: async () => ({ created: false, quote }) } as unknown as CrmRepository,
    { notifyQuoteRequested: async (_actor: PublicUser, _lane: string, desk: QuoteDesk) => { notified = desk === "logistics"; } } as unknown as NotificationService);
  await service.requestLogisticsQuote("vn", "quote", { role: "sourcing" } as PublicUser);
  assert.equal(notified, true);
});

test("a Sourcing contract excludes missing, empty, priced and invalid Logistics drafts on both lanes", async () => {
  const sourcing = handoffInput();
  const priced = handoffInput();
  priced.notes.shippingLabel = "1.250";
  const invalid = handoffInput();
  invalid.notes.logisticsFees = [{ label: "Cước", labelEn: "", value: "Chưa chốt", currency: "USD", itemStt: "" }];
  for (const lane of ["vn", "global"] as const) {
    for (const logisticsSheet of [null, handoffInput(), priced, invalid]) {
      let inserted: unknown[] | undefined;
      const repository = new PostgresCrmRepository({
        query: async (sql: string, values: unknown[]) => {
          if (sql.includes("select ma_hien_thi as code")) return { rowCount: 1, rows: [{ code: "BGS" }] };
          if (sql.includes("select q.id")) return { rowCount: 1, rows: [{
            customer_kind: "SOURCING", quote_workflow: "COMBINED", order_lines: sourcing.orders,
            sent_copy: { sentAt: "2026-11-13", order: sourcing.orders[0], notes: sourcing.notes, bank: sourcing.bank },
            logistics_sheet: logisticsSheet, created_at: new Date(),
          }] };
          if (sql.includes("insert into crm.hop_dong (")) inserted = values;
          return { rowCount: 0, rows: [] };
        },
      } as unknown as pg.Pool);
      await repository.createContract(lane, "quote", createContractSchema.parse({
        currency: "VND", customerName: "Khách", saleName: "Sale", shipTo: "", product: "Hàng", quantity: 1,
        productValue: 6000, shippingCost: 999, totalValue: 6999, paidAmount: 0, signedOn: "",
      }));
      assert.equal(inserted?.[9], 0);
      assert.equal(inserted?.[10], 6000);
      const stored = JSON.parse(String(inserted?.[16]));
      assert.deepEqual(stored.shipping, [{ currency: "VND", amount: 0 }]);
    }
  }
});

test("creating a contract uses sent Logistics costs instead of a submitted shipping override", async () => {
  for (const lane of ["vn", "global"] as const) {
    let inserted: unknown[] | undefined;
    const shipping = handoffInput();
    shipping.notes.shippingLabel = "1.250";
    const repository = new PostgresCrmRepository({
      query: async (sql: string, values: unknown[]) => {
        if (sql.includes("select ma_hien_thi as code")) return { rowCount: 1, rows: [{ code: "BGS" }] };
        if (sql.includes("select q.id")) return { rowCount: 1, rows: [{ customer_kind: "SOURCING", quote_workflow: "COMBINED", logistics_sheet: {
          ...shipping, quoteStatus: "DA_CO_BAO_GIA", sentQuote: { sentAt: "2026-11-13", order: shipping.orders[0], notes: shipping.notes, bank: shipping.bank },
        }, created_at: new Date() }] };
        if (sql.includes("insert into crm.hop_dong (")) inserted = values;
        return { rowCount: 0, rows: [] };
      },
    } as unknown as pg.Pool);
    await repository.createContract(lane, "quote", createContractSchema.parse({
      currency: "VND", customerName: "Khách", saleName: "Sale", shipTo: "", product: "Hàng", quantity: 1,
      productValue: 10000, shippingCost: 999, totalValue: 10999, paidAmount: 0, signedOn: "",
    }));
    assert.equal(inserted?.[9], 1250);
    assert.equal(inserted?.[10], 11250);
  }
});

test("a Logistics-only contract uses its own quoted freight as the contract value", async () => {
  const shipping = handoffInput();
  shipping.notes.shippingLabel = "1.250";
  let inserted: unknown[] | undefined;
  const repository = new PostgresCrmRepository({
    query: async (sql: string, values: unknown[]) => {
      if (sql.includes("select ma_hien_thi as code")) return { rowCount: 1, rows: [{ code: "BGL" }] };
      if (sql.includes("select q.id") && sql.includes("from crm.bao_gia_logistics_viet_nam q")) return { rowCount: 1, rows: [{ customer_kind: "LOGISTICS", quote_workflow: "SEPARATE", order_lines: shipping.orders, common_notes: shipping.notes, created_at: new Date() }] };
      if (sql.includes("insert into crm.hop_dong (")) inserted = values;
      return { rowCount: 0, rows: [] };
    },
  } as unknown as pg.Pool);
  await repository.createContract("vn", "quote", createContractSchema.parse({
    currency: "VND", customerName: "Khách", saleName: "Sale", shipTo: "", product: "Hàng", quantity: 1,
    productValue: 0, shippingCost: 0, totalValue: 0, paidAmount: 0, signedOn: "",
  }));
  assert.equal(inserted?.[8], 0);
  assert.equal(inserted?.[9], 1250);
  assert.equal(inserted?.[10], 1250);
});

test("creating a contract keeps the logistics currency and totals in the main currency", async () => {
  const sheet = handoffInput();
  sheet.notes.freight = { rate: 3.5, cbmRate: null, basis: "kg", currency: "", total: 857.15, totalManual: false };
  sheet.notes.logisticsFees = [{ label: "Phụ phí địa chỉ", labelEn: "", value: "36,", currency: "USD", itemStt: "" }];
  sheet.orders[0].priceColumns = [{ currency: "USD", rate: 25769.0653 }];
  let inserted: unknown[] | undefined;
  const repository = new PostgresCrmRepository({
    query: async (sql: string, values: unknown[]) => {
      if (sql.includes("select ma_hien_thi as code")) return { rowCount: 1, rows: [{ code: "BGS" }] };
      if (sql.includes("select q.id")) return { rowCount: 1, rows: [{ customer_kind: "SOURCING", quote_workflow: "COMBINED", logistics_sheet: {
        ...sheet, quoteStatus: "DA_CO_BAO_GIA", sentQuote: { sentAt: "2026-11-13", order: sheet.orders[0], notes: sheet.notes, bank: sheet.bank },
      }, created_at: new Date() }] };
      if (sql.includes("insert into crm.hop_dong (")) inserted = values;
      return { rowCount: 0, rows: [] };
    },
  } as unknown as pg.Pool);
  await repository.createContract("vn", "quote", createContractSchema.parse({
    currency: "VND", customerName: "Khách", saleName: "Sale", shipTo: "", product: "Hàng", quantity: 1,
    productValue: 10000, shippingCost: 999, totalValue: 10999, paidAmount: 0, signedOn: "",
  }));
  assert.equal(inserted?.[9], 893.15);
  assert.equal(inserted?.[10], 23025640.67);
  assert.equal(inserted?.[15], "USD");
  const stored = JSON.parse(String(inserted?.[16])) as { shipping: { currency: string; amount: number; converted?: number }[] };
  assert.deepEqual(stored.shipping, [{ currency: "USD", amount: 893.15, converted: 23015640.67 }]);
});

test("contract total is shown in the main currency and payments convert at the same rate", () => {
  const amounts = {
    product: [{ currency: "VND", amount: 45181160 }],
    shipping: [{ currency: "USD", amount: 893.15, converted: 23015640.67 }],
  };
  assert.deepEqual(totalsInMain(amounts, "VND"), [{ currency: "VND", amount: 68196800.67 }]);
  const paid = paymentsInMain([{ currency: "VND", amount: 2627 }, { currency: "USD", amount: 100 }], amounts, "VND");
  assert.deepEqual(paid, [{ currency: "VND", amount: 2627 }, { currency: "VND", amount: 2576906.53 }]);
  assert.deepEqual(remainderAfterPayments(totalsInMain(amounts, "VND"), paid), [{ currency: "VND", amount: 65617267.14 }]);
  // Thiếu tỷ giá thì không đoán: giữ riêng từng loại tiền.
  const noRate = { product: amounts.product, shipping: [{ currency: "USD", amount: 893.15 }] };
  assert.deepEqual(totalsInMain(noRate, "VND"), [{ currency: "VND", amount: 45181160 }, { currency: "USD", amount: 893.15 }]);
});

test("USD contract accepts VND receipt at the rate of each transfer", () => {
  const amounts = { product: [{ currency: "USD", amount: 100 }], shipping: [] };
  const payments = [{ currency: "VND", amount: 1_250_000, exchangeRate: 25_000 }, { currency: "VND", amount: 1_300_000, exchangeRate: 26_000 }];
  const paid = paymentsInMain(payments, amounts, "USD");
  assert.deepEqual(paid, [{ currency: "USD", amount: 50 }, { currency: "USD", amount: 50 }]);
  assert.deepEqual(remainderAfterPayments(totalsInMain(amounts, "USD"), paid), [{ currency: "USD", amount: 0 }]);
});

test("Sale cannot set prices on new orders or new lines; Logistics prices them later", () => {
  const stored = handoffInput();
  stored.orders[0].lines[0].pricePerSet = 900;
  stored.orders[0].lines[0].lineTotal = 10800;
  stored.orders[0].lines[0].basis = "kg";
  const current = { ...stored, id: "quote", customerKind: "LOGISTICS", quoteWorkflow: "LEGACY" } as QuoteRecord;
  const submitted = structuredClone(stored);
  // Dòng mới trong đơn cũ, và một đơn mới, đều gửi kèm giá.
  const newLine = structuredClone(submitted.orders[0].lines[0]);
  newLine.stt = "2";
  newLine.pricePerSet = 5;
  newLine.lineTotal = 50;
  newLine.basis = "m2";
  newLine.prices = [{ currency: "USD", pricePerSet: 1, lineTotal: 10, lineTotalManual: false }];
  submitted.orders[0].lines.push(newLine);
  const newOrder = structuredClone(submitted.orders[0]);
  newOrder.id = "00000000-0000-4000-8000-0000000000aa";
  newOrder.name = "Đơn mới của Sale";
  newOrder.currency = "USD";
  newOrder.rate = 25000;
  newOrder.priceColumns = [{ currency: "CNY", rate: 3500 }];
  submitted.orders.push(newOrder);
  const saved = preserveQuotePrices(current, submitted);
  assert.equal(saved.orders[0].lines[0].pricePerSet, 900);
  assert.equal(saved.orders[0].lines[0].lineTotal, 10800);
  assert.equal(saved.orders[0].lines[0].basis, "kg");
  assert.equal(saved.orders[0].lines[1].pricePerSet, null);
  assert.equal(saved.orders[0].lines[1].lineTotal, null);
  assert.equal(saved.orders[0].lines[1].basis, "unit");
  assert.deepEqual(saved.orders[0].lines[1].prices, []);
  const created = saved.orders[1];
  assert.equal(created.rate, null);
  assert.deepEqual(created.priceColumns, []);
  for (const row of created.lines) {
    assert.equal(row.pricePerSet, null);
    assert.equal(row.lineTotal, null);
    assert.deepEqual(row.prices, []);
  }
});

test("Logistics desk only sees combined Sourcing quotes after the hand-off", async () => {
  const statements: string[] = [];
  const repository = new PostgresCrmRepository({
    query: async (sql: string) => {
      statements.push(sql);
      return { rowCount: 0, rows: [] };
    },
  } as unknown as pg.Pool);
  const search = { q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "" };
  await repository.listQuotes("vn", "logistics", search, ["SOURCING_LOGISTICS"]);
  await repository.findQuote("vn", "logistics", "00000000-0000-0000-0000-000000000001");
  await repository.findQuoteByPotential("vn", "logistics", "00000000-0000-0000-0000-000000000001");
  const shared = statements.filter((sql) => sql.includes("luong_bao_gia = 'COMBINED'"));
  assert.equal(shared.length, 3);
  for (const sql of shared) {
    assert.match(sql, /q\.ban_da_gui is not null/);
    assert.match(sql, /'handoffAt'/);
  }
});

test("Sourcing cannot hand off an empty order to Logistics; the hand-off carries the order information", async () => {
  const withOrders = (orders: unknown) => ({
    rowCount: 1,
    rows: [{ customer_kind: "SOURCING", quote_workflow: "COMBINED", order_lines: orders, sent_copy: null, created_at: new Date() }],
  });
  for (const lane of ["vn", "global"] as const) {
    // Chưa nhập thông tin đơn hàng: từ chối, không ghi gì.
    const writes: string[] = [];
    const empty = new PostgresCrmRepository({
      query: async (sql: string) => {
        if (sql.trimStart().startsWith("update")) writes.push(sql);
        return withOrders([]);
      },
    } as unknown as pg.Pool);
    assert.equal(await empty.requestLogisticsQuote(lane, "quote"), "empty");
    assert.deepEqual(writes, []);

    // Đã nhập đơn hàng nhưng chưa gửi báo giá: phiếu Logistics có đơn hàng và dấu chuyển giao.
    const input = handoffInput();
    let sheet: { orders: typeof input.orders; handoffAt?: string } | undefined;
    const ready = new PostgresCrmRepository({
      query: async (sql: string, values: unknown[]) => {
        if (sql.trimStart().startsWith("update")) {
          sheet = JSON.parse(values[1] as string);
          return { rowCount: 1, rows: [] };
        }
        return withOrders(input.orders);
      },
    } as unknown as pg.Pool);
    const result = await ready.requestLogisticsQuote(lane, "quote");
    assert.notEqual(result, "empty");
    assert.equal(sheet?.orders.length, 1);
    assert.equal(sheet?.orders[0].lines[0].quantity, 12);
    assert.equal(sheet?.orders[0].lines[0].pricePerSet, null);
    assert.ok(sheet?.handoffAt);
  }
});

test("Sending a Sourcing quote requires order information because it also hands off to Logistics", async () => {
  const input = handoffInput();
  input.orders[0].lines = [];
  const repository = new PostgresCrmRepository({
    query: async (sql: string) => {
      assert.equal(sql.trimStart().startsWith("update"), false);
      return { rowCount: 1, rows: [{ customer_kind: "SOURCING", quote_workflow: "COMBINED", created_at: new Date() }] };
    },
  } as unknown as pg.Pool);
  assert.equal(await repository.sendQuote("vn", "sourcing", "quote", input), "empty");
});

test("Service rejects an empty Sourcing hand-off with a clear rule error", async () => {
  const service = new CrmService({ findQuote: async () => ({ customerKind: "SOURCING", quoteWorkflow: "COMBINED" }), requestLogisticsQuote: async () => "empty" } as unknown as CrmRepository);
  await assert.rejects(
    () => service.requestLogisticsQuote("vn", "quote", { role: "sourcing" } as PublicUser),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 400,
  );
});

test("missing VND rate names the quote field that still needs a rate", () => {
  const order = { id: "00000000-0000-4000-8000-000000000002", name: "A", selected: true, currency: "USD", rate: null, priceColumns: [], lines: [] };
  const notes = { ...handoffInput().notes, totalLabel: "200", logisticsFees: [], freight: { rate: null, cbmRate: null, basis: "lump" as const, currency: "AUD", total: 100, totalManual: true, vndRate: null } };
  assert.equal(quoteVndAmount({ orders: [order], notes }, "sourcing").rateGap, "Đơn hàng, ô Quy đổi VND: 1 USD =");
  assert.equal(quoteVndAmount({ orders: [{ ...order, currency: "VND", rate: 25_000 }], notes }, "logistics").rateGap, "Chi phí vận chuyển, ô Quy đổi VND: 1 AUD =");
});
