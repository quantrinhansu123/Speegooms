import assert from "node:assert/strict";
import test from "node:test";
import { defaultQuoteBank, fclQuoteSchema, quoteAmount, updateQuoteSchema, quoteSheetInputOf } from "@speego/shared";
import { quoteSheetHtml } from "./quote-print";
import { buildQuoteWorkbook } from "./quote-excel";

test("company header and Regions Wire/ACH details agree in print/PDF and Excel, including old default accounts", async () => {
  const draft = updateQuoteSchema.parse({
    templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
    orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "Bank details", selected: true, currency: "USD", lines: [] }],
    notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [] },
    bank: { title: "", accountName: "", accountNumber: "", routingNumber: "" },
  });
  const banks = [draft.bank, defaultQuoteBank, { title: "Tài khoản ngân hàng ACH", accountName: "SPEEGO LOGISTICS LLC", accountNumber: "0370750653", routingNumber: "111900785" }];
  const header = ["SPEEGO LOGISTICS CORPORATION", "7303 Breen Dr, Houston, TX 77086, US", "01 Đường số 4, KDC Cityland Park Hills, phường Gò Vấp, HCM", "1800-550-1496", "sales@speegologistic.com"];
  for (const lang of ["vi", "en"] as const) for (const logisticsClass of ["LCL", "FCL"]) for (const payment of [undefined, { quoteCurrency: "USD", currency: "USD", exchangeRate: null }]) for (const bank of banks) {
    const input = quoteSheetInputOf({ ...draft, bank, notes: { ...draft.notes, payment, ...(logisticsClass === "FCL" ? { fcl: fclQuoteSchema.parse({ charges: [] }) } : {}) },
      code: "BANK", customerName: "Test", companyName: null, address: null, phone: null, email: null, shippingMode: "SEA", logisticsClass }, draft.orders[0], lang);
    const html = quoteSheetHtml(input);
    const workbook = await buildQuoteWorkbook(input);
    const sheet = JSON.stringify(workbook.worksheets[0].getSheetValues());
    const masthead = html.slice(html.indexOf('<header class="masthead">'), html.indexOf("</header>"));
    for (const value of header) {
      assert.ok(masthead.includes(value), `HTML header: ${value}`);
      assert.ok(sheet.includes(value), `Excel header: ${value}`);
    }
    for (const output of [html, sheet]) {
      for (const value of ["7303 Breen Dr, Suite D2, Houston, TX 77086, US.", "REGIONS BANK", "2730 Gessner Rd, Houston, TX 77080", "WIRE TRANSFER", "ACH TRANSFER", "0379414656", "062005690", "UPNBUS44", "111900785"]) assert.ok(output.includes(value), value);
      assert.doesNotMatch(output, /SPEEGO LOGISTICS LLC|0370750653|079\.673\.8695|Leadvisors|CÔNG TY TNHH SPEEGO/);
    }
    assert.match(html, /<h3>[^<]*WIRE TRANSFER<\/h3>[\s\S]*?Routing Number<\/span>062005690/);
    assert.match(html, /<h3>[^<]*ACH TRANSFER\)?<\/h3>[\s\S]*?Routing Number<\/span>111900785/);
    if (lang === "vi") assert.ok(html.includes("2730 Gessner Rd, Houston, TX 77080, Hoa Kỳ."));
    const accountCells: string[] = [];
    workbook.worksheets[0].eachRow((row) => row.eachCell((cell) => {
      if (cell.address === cell.master.address && cell.value === "0379414656") accountCells.push(cell.value);
    }));
    assert.equal(accountCells.length, 2);
  }
});

test("a chosen custom bank is preserved in LCL/FCL outputs before payment is configured", async () => {
  const draft = updateQuoteSchema.parse({
    templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
    orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "Custom bank", selected: true, currency: "USD", lines: [] }],
    notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [] },
    bank: { custom: true, title: "<Chosen bank>", bankName: "Test Bank", accountName: "SPEEGO LOGISTICS LLC", accountNumber: "0370750653", routingNumber: "111900785" },
  });
  for (const logisticsClass of ["LCL", "FCL"]) {
    const input = quoteSheetInputOf({ ...draft, notes: { ...draft.notes, ...(logisticsClass === "FCL" ? { fcl: fclQuoteSchema.parse({ charges: [] }) } : {}) },
      code: "CUSTOM", customerName: "Test", companyName: null, address: null, phone: null, email: null, shippingMode: "SEA", logisticsClass }, draft.orders[0]);
    const html = quoteSheetHtml(input);
    assert.ok(html.includes("&lt;Chosen bank&gt;"));
    const workbook = await buildQuoteWorkbook(input);
    for (const output of [html, JSON.stringify(workbook.worksheets[0].getSheetValues())]) {
      assert.ok(output.includes("0370750653"));
      assert.ok(output.includes("Test Bank"));
      assert.doesNotMatch(output, /0379414656|REGIONS BANK|062005690|UPNBUS44/);
    }
  }
});

test("HTML/PDF source and Excel show AUD quote, converted VND payment and chosen bank for LCL and FCL", async () => {
  const draft = updateQuoteSchema.parse({
    templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
    orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "AUD quote", selected: true, currency: "AUD", lines: [] }],
    notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [], freight: { total: 120, totalManual: true, rate: null, currency: "AUD" }, payment: { quoteCurrency: "AUD", currency: "VND", exchangeRate: 16000 } },
    bank: { custom: true, title: "", bankName: "Test Bank", accountName: "<script>test</script>", accountNumber: "0123456789", routingNumber: "" },
  });
  for (const logisticsClass of ["LCL", "FCL"]) {
    if (logisticsClass === "FCL") draft.notes.fcl = { to: "Customer", pol: "", pod: "", etd: "", weight: "", volume: "", commodity: "", stuffingDate: "", notes: "", charges: [{ name: "Freight", rate: 120, quantity: 1, unit: "cont", vatAmount: 0, note: "", optional: false }] };
    const input = quoteSheetInputOf({ ...draft, code: "TEST", customerName: "Test", companyName: null, address: null, phone: null, email: null, shippingMode: "SEA", logisticsClass }, draft.orders[0], "en");
    const html = quoteSheetHtml(input);
    assert.ok(html.includes("1 AUD = 16,000 VND"));
    assert.ok(html.includes("1,920,000 VND"));
    assert.ok(html.includes("0123456789"));
    assert.ok(html.includes("&lt;script&gt;test&lt;/script&gt;"));
    assert.ok(!html.includes("REGIONS BANK"));
    assert.ok(!html.includes("<script>test</script>"));
    const workbook = await buildQuoteWorkbook(input);
    const text = JSON.stringify(workbook.worksheets[0].getSheetValues());
    assert.ok(text.includes("1 AUD = 16,000 VND"));
    assert.ok(text.includes("1,920,000 VND"));
    assert.ok(text.includes("0123456789"));
    assert.ok(!text.includes("0370750653"));
    if (logisticsClass === "FCL") assert.ok(text.includes("QUOTATION · AUD"));
  }
});

test("Logistics insurance fee is billed separately from Sale declared goods in LCL and FCL", async () => {
  for (const logisticsClass of ["LCL", "FCL"]) {
    const draft = updateQuoteSchema.parse({
      templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
      orders: [{ id: "00000000-0000-0000-0000-000000000001", name: "Insured goods", selected: true, insurance: true, currency: "USD",
        lines: [{ stt: "1", quantity: 2, pricePerSet: 1000, lineTotal: 2000, weightKg: 1, spec: "", note: "" }] }],
      notes: { totalLabel: "", weightNote: "", validityNote: "", deposit: [],
        freight: { rate: null, total: 120, totalManual: true, currency: "USD" },
        logisticsFees: logisticsClass === "FCL" ? [] : [{ label: "Phí bảo hiểm", labelEn: "Insurance", value: "25,5", currency: "", itemStt: "" }],
        ...(logisticsClass === "FCL" ? { fcl: { charges: [
          { name: "Freight", rate: 120, quantity: 1, unit: "shipment", vatAmount: 0, note: "" },
          { name: "Insurance", rate: 25.5, quantity: 1, unit: "shipment", vatAmount: 0, note: "" },
        ] } } : {}),
      }, bank: { title: "", accountName: "", accountNumber: "", routingNumber: "" },
    });
    const source = { ...draft, code: "INSURANCE", customerKind: "LOGISTICS", customerName: "Test", companyName: null, address: null, phone: null, email: null, shippingMode: "SEA" as const, logisticsClass };
    assert.equal(quoteAmount(source, "logistics").amount, 145.5);
    assert.equal(draft.orders[0].lines[0].lineTotal, 2000);
    const sheet = quoteSheetInputOf(source, draft.orders[0], "en");
    assert.match(quoteSheetHtml(sheet), /Insurance/);
    const workbook = await buildQuoteWorkbook(sheet);
    assert.match(JSON.stringify(workbook.worksheets[0].getSheetValues()), /Insurance/);
  }
});
