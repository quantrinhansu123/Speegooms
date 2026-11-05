import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuoteSheetModel,
  defaultQuoteBank,
  emptyQuoteFreight,
  formatQuoteNumber,
  quoteAmount,
  quotePrintText,
  type QuoteLine,
  type QuoteNotes,
  type QuoteSheetInput,
} from "@speego/shared";

const line = (patch: Partial<QuoteLine> = {}): QuoteLine => ({
  stt: "1", image: "", images: [], quantity: 2, pricePerSet: 10, lineTotal: 20, weightKg: null, spec: "Ghế gỗ sồi", note: "", specEn: "", noteEn: "",
  unit: "set", basis: "unit", cbm: null, areaM2: null, packages: [], attrs: [], prices: [], lineTotalManual: false, ...patch,
});

const notes = (patch: Partial<QuoteNotes> = {}): QuoteNotes => ({
  totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "", weightNoteEn: "", validityNoteEn: "", depositEn: [], deposit: [], logisticsFees: [], opsExtra: "", freight: emptyQuoteFreight, ...patch,
});

const customer = { customerName: "An", companyName: "ABC", address: "HN", phone: "090", email: "a@b.c" };
const deps = { packagesNote: () => "" };

const input = (patch: Partial<QuoteSheetInput> = {}): QuoteSheetInput => ({
  customer, lines: [line()], currency: "USD", notes: notes(), bank: { title: "", accountName: "", accountNumber: "", routingNumber: "" },
  ...patch,
});

test("tỷ giá là loại tiền được chọn: giá in nguyên như đã nhập, không quy đổi", () => {
  const model = buildQuoteSheetModel(input(), deps);
  assert.equal(model.currency, "USD");
  assert.equal(model.lines[0]?.price, 10);
  assert.equal(model.totals.goods, 20);
  assert.equal("rateLines" in model, false);
  assert.equal(JSON.stringify(model).includes("Quy đổi"), false);
});

test("loại tiền trùng với tiền chính không thành cột thêm", () => {
  const model = buildQuoteSheetModel(input({ priceColumns: [{ currency: "USD", rate: null }, { currency: "CNY", rate: null }] }), deps);
  assert.deepEqual(model.extraCurrencies, ["CNY"]);
});

test("cột tiền thêm lấy giá và tổng theo từng loại tiền", () => {
  const model = buildQuoteSheetModel(input({
    priceColumns: [{ currency: "CNY", rate: 3500 }],
    lines: [
      line({ prices: [{ currency: "CNY", pricePerSet: 70, lineTotal: 140, lineTotalManual: false }] }),
      line({ stt: "2", prices: [{ currency: "CNY", pricePerSet: 30, lineTotal: 60, lineTotalManual: false }] }),
    ],
  }), deps);
  assert.equal(model.lines[0]?.extra[0]?.total, 140);
  assert.equal(model.totals.extra.CNY, 200);
});

test("tính giá theo m2: định mức mỗi đơn vị hàng, hiện ở cột Kg/CBM/m2 kèm đơn vị", () => {
  const model = buildQuoteSheetModel(input({ lines: [line({ basis: "m2", areaM2: 8, pricePerSet: 12.5, lineTotal: 300, quantity: 3, productName: "Thảm" })] }), deps);
  assert.equal(model.lines[0]?.metric, 8);
  assert.equal(model.lines[0]?.metricUnit, "m2/cái");
  assert.equal(model.lines[0]?.priceUnit, "/m2");
  assert.equal(model.lines[0]?.productName, "Thảm");
  // Tính theo đơn vị thì không có định mức.
  assert.equal(buildQuoteSheetModel(input(), deps).lines[0]?.metric, null);
});

test("tổng CBM của đơn = CBM mỗi đơn vị × số lượng", () => {
  const model = buildQuoteSheetModel(input({ lines: [line({ cbm: 0.5, quantity: 4 }), line({ stt: "2", cbm: 1, quantity: null })] }), deps);
  assert.equal(model.totals.cbm, 3);
});

test("mỗi mặt hàng có một dòng chi phí riêng và tổng theo từng loại tiền", () => {
  const model = buildQuoteSheetModel(input({
    notes: notes({
      logisticsFees: [
        { label: "Mặt hàng 1", labelEn: "", value: "100", currency: "USD", itemStt: "1" },
        { label: "Mặt hàng 2", labelEn: "", value: "500", currency: "CNY", itemStt: "2" },
        { label: "Mặt hàng 3", labelEn: "", value: "50", currency: "", itemStt: "3" },
      ],
    }),
  }), deps);
  assert.deepEqual(model.fees.map((fee) => [fee.itemStt, fee.currency]), [["1", "USD"], ["2", "CNY"], ["3", "USD"]]);
  assert.deepEqual(model.feeSubtotals, [{ currency: "USD", amount: 150 }, { currency: "CNY", amount: 500 }]);
});

test("tổng vận chuyển cũ không che tổng phí đã nhập", () => {
  const model = buildQuoteSheetModel(input({ notes: notes({ shippingLabel: "2.000", logisticsFees: [{ label: "Cảng", labelEn: "", value: "1", currency: "", itemStt: "" }] }) }), deps);
  assert.deepEqual(model.feeSubtotals, [{ currency: "USD", amount: 1 }]);
  assert.equal(model.shippingText, "2.000");
});

test("tổng chi phí vận chuyển không cộng lẫn khác loại tiền", () => {
  const sheet = {
    orders: [{
      id: "00000000-0000-4000-8000-000000000001", name: "A", selected: true, currency: "USD", rate: 25400, priceColumns: [], lines: [line()],
    }],
    notes: notes({ logisticsFees: [
      { label: "Cảng", labelEn: "", value: "100", currency: "USD", itemStt: "" },
      { label: "Nội địa", labelEn: "", value: "500", currency: "CNY", itemStt: "" },
    ] }),
  };
  assert.equal(quoteAmount(sheet, "logistics").amount, null);
  sheet.notes.logisticsFees = [{ label: "Cảng", labelEn: "", value: "100", currency: "USD", itemStt: "" }, { label: "Bốc", labelEn: "", value: "20", currency: "", itemStt: "" }];
  assert.equal(quoteAmount(sheet, "logistics").amount, 120);
});

test("tài khoản ACH mặc định luôn có khi báo giá để trống, và giữ giá trị đã nhập", () => {
  const empty = buildQuoteSheetModel(input(), deps);
  assert.equal(empty.bank.rows.length, 3);
  assert.deepEqual(empty.bank.rows.map(([, value]) => value), [defaultQuoteBank.accountName, defaultQuoteBank.accountNumber, defaultQuoteBank.routingNumber]);
  const custom = buildQuoteSheetModel(input({ bank: { title: "ACH", accountName: "X LLC", accountNumber: "123", routingNumber: "" } }), deps);
  assert.deepEqual(custom.bank.rows.map(([, value]) => value), ["X LLC", "123", defaultQuoteBank.routingNumber]);
});

test("nhãn cột Quy cách và ngôn ngữ Anh/Việt", () => {
  assert.equal(quotePrintText.vi.spec, "Quy cách");
  assert.equal(quotePrintText.en.spec, "Specification");
  assert.equal(quotePrintText.vi.title, "BÁO GIÁ");
  assert.equal(quotePrintText.en.title, "QUOTATION");
  const keys = Object.keys(quotePrintText.vi).sort();
  assert.deepEqual(Object.keys(quotePrintText.en).sort(), keys);
  for (const key of keys) {
    assert.ok((quotePrintText.vi as unknown as Record<string, string>)[key], `vi.${key}`);
    assert.ok((quotePrintText.en as unknown as Record<string, string>)[key], `en.${key}`);
  }
  const model = buildQuoteSheetModel(input({ lang: "en" }), deps);
  assert.equal(model.t.spec, "Specification");
  assert.equal(model.company.rows[0]?.[0], "Hanoi office");
  assert.equal(formatQuoteNumber(1234.5, "en"), "1,234.50");
  assert.equal(formatQuoteNumber(1234.5, "vi"), "1.234,50");
  assert.equal(formatQuoteNumber(1234, "en"), "1,234");
  assert.equal(formatQuoteNumber(0.035, "vi", 3), "0,035");
  assert.equal(formatQuoteNumber(0.035, "en", 3), "0.035");
});

test("đơn vị mặc định trên file khách là cái, tiếng Anh là pcs, đơn vị tự nhập thì giữ", () => {
  const shown = (unit: string, lang: "vi" | "en") => buildQuoteSheetModel(input({ lang, lines: [line({ unit })] }), deps).lines[0]?.unit;
  assert.equal(shown("set", "vi"), "cái");
  assert.equal(shown("", "vi"), "cái");
  assert.equal(shown("cái", "en"), "pcs");
  assert.equal(shown("bộ", "vi"), "bộ");
  assert.equal(shown("bộ", "en"), "bộ");
});

test("cước vận chuyển = giá cước × cân tính phí, ghi đè thì giữ số tay, và có lưu ý mặc định", () => {
  const model = buildQuoteSheetModel(input({
    notes: notes({ freight: { ...emptyQuoteFreight, rate: 2.5 } }),
    freightMetrics: { chargeableKg: 148, cbm: 1.25 },
  }), deps);
  assert.equal(model.freight.total, 370);
  assert.equal(model.freight.chargeableKg, 148);
  assert.equal(model.freight.chargeableCbm, 1.25);
  assert.equal(model.freight.note, quotePrintText.vi.freightNote);
  const manual = buildQuoteSheetModel(input({
    lang: "en",
    notes: notes({ freight: { ...emptyQuoteFreight, rate: 2.5, total: 999, totalManual: true } }),
    freightMetrics: { chargeableKg: 148, cbm: 1.25 },
  }), deps);
  assert.equal(manual.freight.total, 999);
  assert.equal(manual.freight.note, quotePrintText.en.freightNote);
  assert.equal(manual.lines[0]?.unit, "pcs");
  const savedWithoutPackages = buildQuoteSheetModel(input({
    notes: notes({ freight: { ...emptyQuoteFreight, rate: 2.5, total: 370 } }),
  }), deps);
  assert.equal(savedWithoutPackages.freight.total, 370);
});

test("cước kg và CBM cộng với phí theo đúng từng loại tiền", () => {
  const model = buildQuoteSheetModel(input({
    notes: notes({
      freight: { ...emptyQuoteFreight, rate: 2, cbmRate: 10, basis: "both", currency: "USD" },
      logisticsFees: [
        { label: "A", labelEn: "", value: "5", currency: "USD", itemStt: "1" },
        { label: "B", labelEn: "", value: "100000", currency: "VND", itemStt: "" },
      ],
    }),
    freightMetrics: { chargeableKg: 100, cbm: 2 },
  }), deps);
  assert.equal(model.freight.total, 220);
  assert.deepEqual(model.feeSubtotals, [{ currency: "USD", amount: 225 }, { currency: "VND", amount: 100000 }]);
});

test("giá trị logistics dùng cước cộng phụ phí và từ chối cộng khác tiền", () => {
  const order = { id: "00000000-0000-4000-8000-000000000001", name: "A", selected: true, currency: "USD" as const, rate: null, priceColumns: [], lines: [line()] };
  const costNotes = notes({ freight: { ...emptyQuoteFreight, rate: 2, total: 200 }, logisticsFees: [{ label: "Cảng", labelEn: "", value: "5", currency: "USD", itemStt: "" }] });
  assert.equal(quoteAmount({ orders: [order], notes: costNotes }, "logistics").amount, 205);
  assert.equal(quoteAmount({ orders: [order], notes: { ...costNotes, freight: { ...costNotes.freight, currency: "VND" } } }, "logistics").amount, null);
});

test("dòng trống bị bỏ và mã báo giá, ngày được đưa vào mô hình", () => {
  const model = buildQuoteSheetModel(input({ lines: [line(), line({ stt: "", quantity: null, pricePerSet: null, lineTotal: null, spec: "" })], code: "BG-1", issuedOn: "04/11/2026" }), deps);
  assert.equal(model.lines.length, 1);
  assert.deepEqual(model.meta, { code: "BG-1", issuedOn: "04/11/2026", orderName: "" });
});

test("bản tiếng Anh chỉ dùng nội dung tiếng Anh người dùng điền, thiếu thì để trống và ghi nhận", () => {
  const sample = input({
    lang: "en",
    lines: [
      line({ spec: "Ghế gỗ sồi", specEn: "Oak chair", note: "Hàng dễ vỡ", noteEn: "" }),
      line({ stt: "2", spec: "Bàn ăn", specEn: "" }),
    ],
    notes: notes({
      validityNote: "30 ngày", validityNoteEn: "30 days",
      weightNote: "Dự kiến 120kg", weightNoteEn: "",
      deposit: ["Đặt cọc 30%", "Còn lại trước khi giao"], depositEn: ["30% deposit"],
    }),
  });
  const model = buildQuoteSheetModel(sample, deps);
  assert.equal(model.lines[0]?.spec, "Oak chair");
  assert.equal(model.lines[0]?.note, "");
  assert.equal(model.lines[1]?.spec, "");
  assert.equal(model.validityNote, "30 days");
  assert.equal(model.weightNote, "");
  assert.deepEqual(model.deposit, ["30% deposit"]);
  assert.deepEqual([...model.missing].sort(), ["Ghi chú (dòng 1)", "Ghi chú cân nặng / CBM", "Quy cách (dòng 2)", "Đặt cọc (dòng 2)"].sort());
  // Bản tiếng Việt không bị ảnh hưởng và không ghi nhận thiếu.
  const vi = buildQuoteSheetModel({ ...sample, lang: "vi" }, deps);
  assert.equal(vi.lines[0]?.spec, "Ghế gỗ sồi");
  assert.equal(vi.validityNote, "30 ngày");
  assert.deepEqual(vi.missing, []);
});

test("thuộc tính xưởng cố định có tên tiếng Anh gán sẵn, thuộc tính khác phải tự điền", () => {
  const withAttrs = (lang: "vi" | "en") => buildQuoteSheetModel(input({
    lang,
    lines: [line({
      attrs: [
        { key: "Chất liệu", value: "Gỗ sồi", keyEn: "", valueEn: "Oak" },
        { key: "Màu", value: "Nâu", keyEn: "", valueEn: "" },
        { key: "Xuất xứ", value: "Việt Nam", keyEn: "Origin", valueEn: "Vietnam" },
      ],
    })],
  }), deps);
  assert.equal(withAttrs("vi").lines[0]?.note, "Chất liệu: Gỗ sồi\nMàu: Nâu\nXuất xứ: Việt Nam");
  const en = withAttrs("en");
  assert.equal(en.lines[0]?.note, "Material: Oak\nOrigin: Vietnam");
  assert.ok(en.missing.some((label) => label.includes("Màu")));
});

test("dòng chi phí: mặt hàng tự có tên tiếng Anh từ quy cách tiếng Anh, phí chung phải tự điền", () => {
  const model = buildQuoteSheetModel(input({
    lang: "en",
    lines: [line({ spec: "Ghế gỗ", specEn: "Wooden chair" })],
    notes: notes({ logisticsFees: [
      { label: "Mặt hàng 1 - Ghế gỗ", labelEn: "", value: "100", currency: "USD", itemStt: "1" },
      { label: "Phí cảng", labelEn: "Port fee", value: "50", currency: "USD", itemStt: "" },
      { label: "Phí kho", labelEn: "", value: "10", currency: "USD", itemStt: "" },
    ] }),
  }), deps);
  assert.deepEqual(model.fees.map((fee) => fee.label), ["Item 1 - Wooden chair", "Port fee", ""]);
  assert.ok(model.missing.includes('Tên chi phí "Phí kho"'));
  assert.ok(!model.missing.some((label) => label.includes("Mặt hàng 1")));
});
