import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildQuoteSheetModel, defaultQuoteBank, emptyQuoteFreight, quoteValidity, updateQuoteSchema,
  type PublicUser, type QuoteNotes, type SentQuote,
} from "@speego/shared";
import { CrmService } from "../services/crm.service";
import { preserveQuotePrices, quoteDeskPatch } from "../services/quote-edit-policy";
import type { CrmRepository, QuoteRecord } from "../repositories/crm.repository";

const orderId = "00000000-0000-4000-8000-000000000001";

const baseInput = (notes: Record<string, unknown> = {}) => updateQuoteSchema.parse({
  templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
  orders: [{ id: orderId, name: "Order", selected: true, currency: "VND", rate: null,
    lines: [{ stt: "1", quantity: 1, pricePerSet: 10, lineTotal: 10, weightKg: null, unit: "set", spec: "Ghế", note: "" }] }],
  notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [], ...notes }, bank: defaultQuoteBank,
});

const sentOf = (sentAt: string, validityDays: number | null): Pick<SentQuote, "sentAt" | "notes"> => ({
  sentAt,
  notes: { ...baseInput().notes, validityDays } as QuoteNotes,
});

test("quoteValidity counts from the latest send and ignores quotes without days", () => {
  assert.equal(quoteValidity(null), null);
  assert.equal(quoteValidity(sentOf("2026-11-01T03:00:00.000Z", null)), null);
  const sent = sentOf("2026-11-01T03:00:00.000Z", 7);
  const day = (iso: string) => quoteValidity(sent, new Date(iso));
  assert.deepEqual(day("2026-11-01T05:00:00.000Z"), { days: 7, sentOn: "2026-11-01", expiresOn: "2026-11-08", remainingDays: 7, expired: false });
  assert.equal(day("2026-11-08T16:00:00.000Z")?.remainingDays, 0);
  assert.equal(day("2026-11-08T16:00:00.000Z")?.expired, false);
  // 17:00 UTC ngày 8 đã là 00:00 ngày 9 giờ Việt Nam.
  assert.equal(day("2026-11-08T17:00:00.000Z")?.expired, true);
  // Gửi lại: sentAt mới thì đếm lại từ đầu.
  const resent = sentOf("2026-11-10T03:00:00.000Z", 7);
  assert.equal(quoteValidity(resent, new Date("2026-11-10T05:00:00.000Z"))?.remainingDays, 7);
});

test("sentAt late in the Vietnam day is counted on the Vietnam date", () => {
  const sent = sentOf("2026-11-01T18:30:00.000Z", 3);
  assert.equal(quoteValidity(sent, new Date("2026-11-01T18:30:00.000Z"))?.sentOn, "2026-11-02");
});

test("validity days must be a whole number of 1 to 365 days", () => {
  for (const days of [0, -1, 366, 1.5]) assert.equal(updateQuoteSchema.safeParse({ ...baseInput(), notes: { ...baseInput().notes, validityDays: days } }).success, false);
  for (const days of [1, 30, 365, null, undefined]) assert.equal(updateQuoteSchema.safeParse({ ...baseInput(), notes: { ...baseInput().notes, validityDays: days } }).success, true);
});

test("print sheet writes the validity sentence from days and falls back to the old note", () => {
  const notes = (patch: Partial<QuoteNotes>): QuoteNotes => ({
    totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "30 ngày cũ", weightNoteEn: "", validityNoteEn: "", depositEn: [], deposit: [], logisticsFees: [], opsExtra: "", freight: emptyQuoteFreight, ...patch,
  });
  const make = (patch: Partial<QuoteNotes>, lang: "vi" | "en") => buildQuoteSheetModel({
    customer: { customerName: "An", companyName: "", address: "", phone: "", email: "" },
    lines: [], currency: "USD", notes: notes(patch), bank: defaultQuoteBank, lang,
  }, { packagesSpec: () => "" }).validityNote;
  assert.equal(make({ validityDays: 7 }, "vi"), "Báo giá có hiệu lực 7 ngày kể từ ngày gửi báo giá");
  assert.equal(make({ validityDays: 7 }, "en"), "Valid for 7 days from the quotation date");
  assert.equal(make({ validityDays: 1 }, "en"), "Valid for 1 day from the quotation date");
  assert.equal(make({}, "vi"), "30 ngày cũ");
  assert.equal(make({ validityDays: null }, "vi"), "30 ngày cũ");
});

test("Logistics desk saves its own validity days while Sale saves keep them", () => {
  const stored = baseInput({ validityDays: 5 });
  const current = { ...stored, id: "quote", customerKind: "LOGISTICS", quoteWorkflow: "LEGACY" } as QuoteRecord;
  const submitted = baseInput({ validityDays: 14 });
  assert.equal(quoteDeskPatch("logistics", current, submitted).notes.validityDays, 14);
  assert.equal(quoteDeskPatch("sourcing", current, submitted).notes.validityDays, 14);
  assert.equal(preserveQuotePrices(current, submitted).notes.validityDays, 5);
});

test("sending a quote requires validity days on every desk", async () => {
  const sent: unknown[] = [];
  const stored = baseInput();
  const mk = (kind: string, workflow: string) => ({ ...stored, id: "quote", customerKind: kind, quoteWorkflow: workflow, sourcingContext: null, orders: stored.orders } as unknown as QuoteRecord);
  const service = (current: QuoteRecord) => new CrmService({
    findQuote: async () => current,
    sendQuote: async (_lane: string, _desk: string, _id: string, input: unknown) => { sent.push(input); return { ...current, code: "BG", id: "quote" }; },
  } as unknown as CrmRepository);
  const admin = { role: "admin" } as PublicUser;

  await assert.rejects(service(mk("SOURCING", "COMBINED")).sendQuote("vn", "sourcing", "quote", baseInput(), admin), /số ngày hiệu lực/);
  await assert.rejects(service(mk("LOGISTICS", "LEGACY")).sendQuote("vn", "logistics", "quote", baseInput(), admin), /số ngày hiệu lực/);
  // Logistics desk cannot reuse days from the sourcing sheet: the sheet's own value counts.
  await assert.rejects(service(mk("SOURCING", "COMBINED")).sendQuote("vn", "logistics", "quote", baseInput(), admin), /số ngày hiệu lực/);
  assert.equal(sent.length, 0);

  await service(mk("SOURCING", "COMBINED")).sendQuote("vn", "sourcing", "quote", baseInput({ validityDays: 7 }), admin);
  await service(mk("LOGISTICS", "LEGACY")).sendQuote("vn", "logistics", "quote", baseInput({ validityDays: 10 }), admin);
  assert.deepEqual(sent.map((item) => (item as { notes: QuoteNotes }).notes.validityDays), [7, 10]);
});
