import assert from "node:assert/strict";
import pg from "pg";
import { createMessageSchema, convertMessageSchema, defaultQuoteBank, emptyQuoteFreight, fclQuoteSchema, quoteOrderSchema, updateQuoteSchema } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { crmActor } from "../lib/crm-actor";

const url = new URL(process.env.QUOTE_COST_LOCAL_URL ?? "postgresql://data_lanh_test@127.0.0.1:55441/speego_quote_cost_local");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/speego_quote_cost_local");
const pool = new pg.Pool({ connectionString: url.toString() });
const repo = new PostgresCrmRepository(pool);

async function main() {
  try {
    await crmActor.run({ id: "u-admin", role: "admin", name: "Admin local", email: "admin@speego.vn", department: "", title: "" }, async () => {
      for (const [index, kind] of ["SOURCING", "LOGISTICS", "FCL"].entries()) {
        const name = `TEST-GIA-GOC-${kind}`;
        const exists = await pool.query("select id from crm.tin_nhan_viet_nam where ten_khach_hang_tho = $1", [name]);
        const logistics = kind !== "SOURCING";
        const phone = `090088800${index}`;
        const message = exists.rows[0] ?? await repo.createMessage("vn", createMessageSchema.parse({ customerName: name, phone, email: "", goods: "Ghế mẫu", note: "Dữ liệu test local giá gốc", demand: logistics ? "SHIPPING" : "SOURCING", market: "US", saleName: "Trần Thị Bình", painPoint: "Cần báo giá", linkMess: "", brand: "SPEEGO_US" }), "u-svn");
        const converted = await repo.convertMessage("vn", message.id, convertMessageSchema.parse({ handlerId: "u-svn", phone, brand: "SPEEGO_US", customerType: "INDIVIDUAL", careChannel: "FACEBOOK", productInterest: "Ghế mẫu", address: "Hà Nội", saleNote: "Dữ liệu test local", requirements: "Đơn test giá gốc", reason: "Khách cần báo giá", shippingMode: logistics ? "SEA" : undefined, logisticsClass: logistics ? kind === "FCL" ? "FCL" : "LCL" : undefined, quantityNote: "2 ghế", packageDimensions: "50x40x30 cm", weightKg: "50", shipFromAddress: "Shanghai", shipToAddress: "Los Angeles" }));
        assert.ok(typeof converted !== "string");
        const requested = await repo.requestQuote("vn", converted.potential.id);
        assert.ok(typeof requested !== "string");
        await pool.query("insert into crm.chia_don (tuyen, ban, bao_gia_id, nguoi_nhan_id) values ('vn', $1, $2, $3) on conflict (tuyen, ban, bao_gia_id) do update set nguoi_nhan_id = excluded.nguoi_nhan_id", [requested.desk, requested.quote.id, logistics ? "u-log" : "u-src"]);
        const order = quoteOrderSchema.parse({ id: crypto.randomUUID(), name: "Mẫu giá gốc", selected: true, currency: logistics ? "USD" : "VND", rate: logistics ? 25000 : null,
          lines: [{ stt: "1", productName: "Ghế mẫu", quantity: 2, weightKg: 25, spec: "Ghế mẫu dùng test", specEn: "Sample chair", note: "", noteEn: "", pricePerSet: logistics ? null : 100000, originalPrice: logistics ? null : 70000, lineTotal: logistics ? null : 200000, packages: [] }] });
        const input = updateQuoteSchema.parse({ templateId: null, opsNote: "Test local giá gốc", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO", orders: [order], bank: defaultQuoteBank,
          notes: { totalLabel: "", shippingLabel: logistics ? "610" : "", weightNote: "", validityNote: "", validityDays: 7, deposit: [],
            freight: { ...emptyQuoteFreight, currency: "USD", rate: logistics ? 12 : null, total: logistics ? 600 : null, totalManual: logistics, originalPrice: logistics ? 450 : null },
            logisticsFees: logistics && kind !== "FCL" ? [{ label: "Phụ phí địa chỉ", labelEn: "Address fee", value: "10", currency: "USD", originalPrice: 7 }] : [],
            ...(kind === "FCL" ? { fcl: fclQuoteSchema.parse({ to: name, pol: "Shanghai", pod: "Los Angeles", weight: "5000 kg", volume: "1x40HC", commodity: "Furniture", charges: [{ name: "Ocean Freight", rate: 7000, originalPrice: 6000, quantity: 1, unit: "cont", vatAmount: 0, note: "" }] }) } : {}),
          } });
        const saved = await repo.updateQuote("vn", requested.desk, requested.quote.id, input);
        assert.ok(typeof saved !== "string");
        const sent = await repo.sendQuote("vn", requested.desk, requested.quote.id, input);
        assert.ok(typeof sent !== "string");
        const read = await repo.findQuote("vn", requested.desk, requested.quote.id);
        assert.ok(read?.sentQuote);
        if (logistics) {
          assert.equal(read.notes.freight.originalPrice, 450);
          if (kind === "FCL") assert.equal(read.notes.fcl?.charges[0].originalPrice, 6000);
          else assert.equal(read.notes.logisticsFees[0].originalPrice, 7);
        } else {
          assert.equal(read.orders[0].lines[0].originalPrice, 70000);
          assert.equal(read.sentQuote.order.lines[0].originalPrice, 70000);
        }
        console.log(`${name}: ${read.code} (${requested.desk})`);
      }
    });
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
