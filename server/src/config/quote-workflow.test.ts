import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canViewQuote, convertMessageSchema, customerKindSchema, isCombinedSourcing,
  quoteAccessKind, quoteNotifyRoles,
} from "@speego/shared";
import type pg from "pg";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { CrmService } from "../services/crm.service";
import { quoteDeskPatch } from "../services/quote-edit-policy";
import type { CrmRepository, QuoteRecord } from "../repositories/crm.repository";
import type { NotificationService } from "../services/notification.service";
import { defaultQuoteBank, logisticsOrderFromSourcing, updateQuoteSchema, type PublicUser, type QuoteDesk } from "@speego/shared";

test("conversion reason is optional while customer requirements remain mandatory", () => {
  for (const reason of [undefined, "", "   ", "Khách cần mua hàng"]) {
    const result = convertMessageSchema.parse({ requirements: "Đơn hàng", reason });
    assert.equal(result.reason, reason?.trim() ?? "");
  }
  assert.equal(convertMessageSchema.safeParse({ requirements: " " }).success, false);
  assert.equal(customerKindSchema.safeParse("SOURCING_LOGISTICS").success, false);
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

test("both lanes create a shared sheet only for the persisted combined workflow", async () => {
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
      assert.equal(statements.some((sql) => sql.includes("set bao_gia_logistics")), workflow === "COMBINED");
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

test("a new combined order notifies both desks once", async () => {
  const desks: QuoteDesk[] = [];
  let created = true;
  const quote = { id: "quote", code: "BGS", customerKind: "SOURCING", quoteWorkflow: "COMBINED" } as QuoteRecord;
  const service = new CrmService({
    requestQuote: async () => ({ quote, created, desk: "sourcing" }),
  } as unknown as CrmRepository, {
    notifyQuoteRequested: async (_actor: PublicUser, _lane: string, desk: QuoteDesk) => { desks.push(desk); },
  } as unknown as NotificationService);
  await service.requestQuote("vn", "customer", { role: "sale-vn" } as PublicUser);
  assert.deepEqual(desks, ["sourcing", "logistics"]);
  created = false;
  await service.requestQuote("vn", "customer", { role: "sale-vn" } as PublicUser);
  assert.equal(desks.length, 2);
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

test("Logistics can change only costs, while Sourcing owns the order", () => {
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
  submitted.notes.logisticsFees = [{ label: "Vận chuyển", value: "500 VND" }];
  const costs = quoteDeskPatch("logistics", current, submitted);
  assert.deepEqual(costs.orders, original.orders);
  assert.deepEqual(costs.bank, original.bank);
  assert.equal(costs.opsNote, original.opsNote);
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
          assert.match(sql, /bao_gia_logistics = case/);
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
    assert.equal(handoff?.orders[0].lines[0].quantity, 12);
    assert.equal(handoff?.orders[0].lines[0].pricePerSet, null);
  }
});

test("Logistics receives the sent source context and existing shipping work is preserved", async () => {
  const input = handoffInput();
  for (const existing of [false, true]) {
    const source = input.orders[0];
    const shipping = logisticsOrderFromSourcing(source);
    shipping.lines[0].pricePerSet = 77;
    shipping.lines[0].packages = [{ count: 2, lengthCm: 30, widthCm: 40, heightCm: 50, actualKg: 10 }];
    const repository = new PostgresCrmRepository({
      query: async (sql: string) => ({ rowCount: 1, rows: sql.includes("bao_gia_sourcing") ? [{
        customer_kind: "SOURCING", quote_workflow: "COMBINED", created_at: new Date(), ops_note: input.opsNote,
        sent_copy: { sentAt: new Date().toISOString(), order: source, notes: input.notes, bank: input.bank },
        logistics_sheet: { ...input, orders: existing ? [shipping] : [], sentQuote: null },
      }] : [] }),
    } as unknown as pg.Pool);
    const quote = await repository.findQuote("vn", "logistics", "quote");
    assert.equal(quote?.sourcingContext?.order.lines[0].pricePerSet, 500);
    assert.equal(quote?.sourcingContext?.opsNote, "Giao hàng dễ vỡ");
    assert.equal(quote?.orders[0].lines[0].quantity, 12);
    assert.equal(quote?.orders[0].lines[0].pricePerSet, existing ? 77 : null);
    assert.equal(quote?.orders[0].lines[0].packages.length, existing ? 1 : 0);
  }
});
