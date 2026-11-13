import assert from "node:assert/strict";
import { test } from "node:test";
import { contractQuoteProblems, defaultQuoteBank, orderShippingChanged, updateQuoteSchema, type PublicUser, type QuoteOrder } from "@speego/shared";
import { CrmService } from "../services/crm.service";
import type { CrmRepository, QuoteRecord } from "../repositories/crm.repository";

const input = updateQuoteSchema.parse({
  templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
  orders: [{ id: "00000000-0000-4000-8000-000000000001", name: "Đơn", selected: true, currency: "VND", rate: null,
    lines: [{ stt: "1", productName: "Ghế", quantity: 10, pricePerSet: 5, lineTotal: 50, weightKg: 2, unit: "cái", spec: "Gỗ", note: "" }] }],
  notes: { totalLabel: "", weightNote: "", validityNote: "", validityDays: 7, deposit: [] }, bank: defaultQuoteBank,
});
const order = input.orders[0] as QuoteOrder;
const sent = { sentAt: "2026-11-06T03:00:00.000Z", order, notes: input.notes, bank: input.bank };
const sheet = (quoteStatus: string, withSent = true) => ({
  templateId: null, templateName: null, opsNote: null, quoteStatus, contractStatus: "CHUA_TAO",
  orders: [order], notes: input.notes, bank: input.bank, sentQuote: withSent ? sent : null,
});
const quote = (patch: Partial<QuoteRecord>) => ({
  ...input, id: "quote", code: "BGS-1", customerKind: "SOURCING", quoteWorkflow: "COMBINED",
  quoteStatus: "DA_CO_BAO_GIA", contractStatus: "CHUA_TAO", sentQuote: sent, logisticsSheet: sheet("DA_CO_BAO_GIA"), ...patch,
} as unknown as QuoteRecord);

test("hợp đồng cần đủ báo giá đã gửi theo loại khách", () => {
  assert.deepEqual(contractQuoteProblems(quote({})), []);
  assert.deepEqual(contractQuoteProblems(quote({ logisticsSheet: null })), ["chưa có báo giá Logistics đã gửi"]);
  assert.deepEqual(contractQuoteProblems(quote({ quoteStatus: "CHUA_CO_BAO_GIA", sentQuote: null })), ["chưa có báo giá Sourcing đã gửi"]);
  assert.deepEqual(contractQuoteProblems(quote({ quoteStatus: "CHUA_CO_BAO_GIA_LAI" })), ["Sourcing đang chờ báo giá lại"]);
  assert.deepEqual(contractQuoteProblems(quote({ logisticsSheet: sheet("CHUA_CO_BAO_GIA_LAI") })), ["Logistics đang chờ báo giá lại"]);
  // Luồng cũ: chỉ cần báo giá Sourcing.
  assert.deepEqual(contractQuoteProblems(quote({ quoteWorkflow: "LEGACY", logisticsSheet: null })), []);
  // KH Logistics: báo giá của chính phiếu.
  assert.deepEqual(contractQuoteProblems(quote({ customerKind: "LOGISTICS", logisticsSheet: null })), []);
  assert.deepEqual(contractQuoteProblems(quote({ customerKind: "LOGISTICS", quoteStatus: "DA_CO_BAO_GIA_LAI", sentQuote: null })), ["chưa có báo giá Logistics đã gửi"]);
  assert.deepEqual(contractQuoteProblems(quote({ customerKind: "LOGISTICS", quoteStatus: "DA_CO_BAO_GIA_LAI" })), []);
});

test("service chặn tạo hợp đồng khi thiếu báo giá", async () => {
  let created = 0;
  const service = (current: QuoteRecord) => new CrmService({
    findQuote: async (_lane: string, desk: string) => (desk === "sourcing" ? current : null),
    createContract: async () => { created += 1; return { code: "HD-1", id: "c" }; },
  } as unknown as CrmRepository);
  await assert.rejects(service(quote({ logisticsSheet: sheet("CHUA_CO_BAO_GIA_LAI") })).createContract("vn", "quote", {} as never), /Logistics đang chờ báo giá lại/);
  assert.equal(created, 0);
  await service(quote({})).createContract("vn", "quote", {} as never);
  assert.equal(created, 1);
});

test("chỉ đổi phần ảnh hưởng tới cước mới tính là đơn đổi", () => {
  assert.equal(orderShippingChanged(null, order), false);
  assert.equal(orderShippingChanged(order, { ...order, lines: order.lines.map((line) => ({ ...line, pricePerSet: 99 })) }), false);
  assert.equal(orderShippingChanged(order, { ...order, lines: order.lines.map((line) => ({ ...line, quantity: 20 })) }), true);
});

test("Sourcing gửi lại với đơn đổi thì báo giá Logistics đã gửi chuyển về chờ báo giá lại", async () => {
  const returned: string[] = [];
  const notified: string[] = [];
  const assignees: (string | undefined)[] = [];
  let rotations = 0;
  const current = quote({});
  const repo = {
    findQuote: async () => current,
    sendQuote: async () => current,
    returnQuote: async (_lane: string, desk: string) => { returned.push(desk); return current; },
  } as unknown as CrmRepository;
  const notes = {
    notifyQuoteSent: async () => undefined,
    notifyQuoteReturned: async (_a: unknown, _l: string, desk: string, _code: string, _id: string, _kind: unknown, assigneeId?: string) => {
      notified.push(desk);
      assignees.push(assigneeId);
    },
  };
  const service = new CrmService(repo, notes as never, null, {
    assign: async () => { rotations++; return { id: "next-worker", name: "Next" }; },
    assignees: async (lane, desk) => {
      assert.equal(lane, "vn");
      assert.equal(desk, "logistics");
      return { [current.id]: { id: "previous-logistics", name: "Previous Logistics" } };
    },
  });
  const admin = { id: "u", role: "admin", name: "Admin" } as PublicUser;
  await service.sendQuote("vn", "sourcing", "quote", input, admin);
  assert.deepEqual(returned, []);
  const changed = { ...input, orders: input.orders.map((item) => ({ ...item, lines: item.lines.map((line) => ({ ...line, quantity: 20 })) })) };
  await service.sendQuote("vn", "sourcing", "quote", changed, admin);
  assert.deepEqual(returned, ["logistics"]);
  assert.deepEqual(notified, ["logistics"]);
  assert.deepEqual(assignees, ["previous-logistics"]);
  assert.equal(rotations, 0);
});
