import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildTemplate, planContracts, planMessages, planPotentials, planQuotes, readWorkbook } from "./crm-import-sheets";

test("message template ignores the sample row", async () => {
  const file = await buildTemplate("messages");
  const book = await readWorkbook(file.body);
  const plan = planMessages(book, ["vn", "global"]);
  assert.equal(plan.rows.length, 0);
  assert.equal(plan.errors.length, 0);
});

test("mess row uses customer_pii and phan_phong", async () => {
  const book = await workbook({
    mess: [
      ["mess_id", "customer_id", "mat_hang", "dich_vu", "pain_point"],
      ["M-9", "KH-9", "Ghe", "LOGISTICS", ""],
    ],
    customer_pii: [
      ["customer_id", "ten_khach", "sdt", "email"],
      ["KH-9", "An", "+84 90-111-222", "an@example.com"],
    ],
    phan_phong: [
      ["mess_id", "phong_sale"],
      ["M-9", "Sale Global"],
    ],
  });
  const plan = planMessages(book, ["vn"]);
  assert.equal(plan.skipped, 1);
  assert.equal(plan.rows.length, 0);

  const both = planMessages(book, ["vn", "global"]);
  assert.equal(both.rows.length, 1);
  assert.equal(both.rows[0]?.lane, "global");
  assert.equal(both.rows[0]?.customerName, "An");
  assert.equal(both.rows[0]?.phone, "8490111222");
  assert.equal(both.rows[0]?.email, "an@example.com");
  assert.equal(both.rows[0]?.demand, "SHIPPING");
  assert.equal(both.rows[0]?.painPoint, "Không ghi pain point");
});

test("potential and quote keep the rfq link", async () => {
  const book = await workbook({
    rfq: [
      ["rfq_id", "mess_id", "ten_hang", "so_luong", "dich_vu", "phong_sale"],
      ["RFQ-2", "M-2", "Ban", "4", "SOURCING", "Sale VN"],
    ],
    rfq_pii: [
      ["rfq_id", "ten_khach", "sdt"],
      ["RFQ-2", "Binh", "0912345678"],
    ],
    rfq_price: [
      ["rfq_id", "gia_bao_usd", "phi_vc_usd"],
      ["RFQ-2", "80", "25"],
    ],
  });
  const potential = planPotentials(book, ["vn"]);
  assert.equal(potential.rows[0]?.messRef, "M-2");
  assert.equal(potential.rows[0]?.fullName, "Binh");
  assert.equal(potential.rows[0]?.kind, "SOURCING");
  assert.equal(potential.rows[0]?.quantityNote, "4");

  const quote = planQuotes(book, ["vn"]);
  assert.equal(quote.rows[0]?.productPrice, 80);
  assert.equal(quote.rows[0]?.freight, 25);
  assert.equal(quote.rows[0]?.kind, "BOTH");
});

test("contract remaining amount becomes the paid amount", async () => {
  const book = await workbook({
    order: [
      ["order_id", "rfq_id", "ten_khach", "ten_hang", "gia_hang_usd", "cuoc_usd", "phong_sale"],
      ["DON-3", "RFQ-3", "Chi", "Ghe", "1000", "200", "Sale VN"],
    ],
    contract: [
      ["order_id", "ngay_ky", "tong_gia_tri_usd", "con_lai_usd"],
      ["DON-3", "01/03/2026", "1200", "200"],
    ],
  });
  const plan = planContracts(book, ["vn"]);
  assert.equal(plan.rows[0]?.totalValue, 1200);
  assert.equal(plan.rows[0]?.paidAmount, 1000);
  assert.equal(plan.rows[0]?.signedOn, "2026-03-01");
  assert.equal(plan.rows[0]?.productValue, 1000);
  assert.equal(plan.rows[0]?.shippingCost, 200);
});

async function workbook(sheets: Record<string, string[][]>): Promise<Awaited<ReturnType<typeof readWorkbook>>> {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = book.addWorksheet(name);
    for (const row of rows) sheet.addRow(row);
  }
  return readWorkbook(Buffer.from(await book.xlsx.writeBuffer()));
}
