import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { convertMessageSchema, createMessageSchema, updateMessageSchema, updatePotentialSchema, type CrmLane, type QuoteDesk } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";

test("Mess/potential name corrections reach existing contracts on both lanes/desks without changing commercial snapshots", { skip: !process.env.CRM_CONTRACT_NAME_TEST_URL }, async () => {
  const url = new URL(process.env.CRM_CONTRACT_NAME_TEST_URL!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.match(url.pathname, /^\/speego_contract_name_test(?:_\d+)?$/);
  const pool = new pg.Pool({ connectionString: url.toString() });
  const repo = new PostgresCrmRepository(pool);
  const tag = randomUUID();
  const fixtures: { lane: CrmLane; desk: QuoteDesk; messageId: string; potentialId: string; contractId: string; original: string; message: ReturnType<typeof createMessageSchema.parse>; frozen: unknown }[] = [];
  const messages: { lane: CrmLane; id: string }[] = [];
  const potentials: { lane: CrmLane; id: string }[] = [];
  let importedId: string | undefined;
  const contractSearch = { q: "", from: "", to: "", opsStatus: "", accountingStatus: "" };
  const read = async (id: string) => (await pool.query("select ten_khach_hang as name, to_jsonb(h) - 'ten_khach_hang' - 'cap_nhat_luc' as frozen from crm.hop_dong h where id = $1::uuid", [id])).rows[0];
  try {
    for (const lane of ["vn", "global"] as const) for (const desk of ["sourcing", "logistics"] as const) {
      const original = `TEST NAME ${tag} ${lane} ${desk}`;
      const messageInput = createMessageSchema.parse({ customerName: original, phone: `0900000${fixtures.length}00`, email: "", goods: "Sample goods", demand: desk === "sourcing" ? "SOURCING" : "SHIPPING", brand: desk === "sourcing" ? "SPEEGO_US" : "LOGISTICS", note: "Name sync regression", market: "US", saleName: "Test Sale", painPoint: "", linkMess: "" });
      const message = await repo.createMessage(lane, messageInput);
      messages.push({ lane, id: message.id });
      const converted = await repo.convertMessage(lane, message.id, convertMessageSchema.parse({ phone: messageInput.phone, brand: messageInput.brand, customerType: "INDIVIDUAL", careChannel: "FACEBOOK", productInterest: "Sample goods", quantityNote: "2", address: "", saleNote: "Name sync test", requirements: "Quote request", reason: "Customer request", ...(desk === "logistics" ? { shippingMode: "AIR", weightKg: "2", shipToAddress: "US" } : {}) }));
      assert.ok(typeof converted === "object");
      potentials.push({ lane, id: converted.potential.id });
      const requested = await repo.requestQuote(lane, converted.potential.id);
      assert.ok(typeof requested === "object");
      assert.equal(requested.desk, desk);
      const snapshot = { customerName: original, saleName: "Test Sale", product: "Frozen goods", productValue: 100, shippingCost: 20, totalValue: 120, paidAmount: 30, balance: 90, currency: "VND", tracking: "FROZEN-TRACK" };
      const contractId = (await pool.query(`insert into crm.hop_dong (tuyen, ma_bao_gia, ten_khach_hang, loai_tien, loai_tien_van_chuyen, gia_tri_san_pham, chi_phi_van_chuyen, tong_gia_tri, so_tien_thanh_toan, ban_gui_van_hanh, ban_gui_ke_toan, gui_ke_toan_luc)
        values ($1, $2::uuid, $3, 'VND', 'VND', 100, 20, 120, 30, $4::jsonb, $4::jsonb, now()) returning id`, [lane, requested.quote.id, original, JSON.stringify(snapshot)])).rows[0].id;
      fixtures.push({ lane, desk, messageId: message.id, potentialId: converted.potential.id, contractId, original, message: messageInput, frozen: (await read(contractId)).frozen });
    }
    importedId = (await pool.query("insert into crm.hop_dong (tuyen, ten_khach_hang, ma_bao_gia) select 'global', $1, ma_bao_gia from crm.hop_dong where id = $2::uuid returning id", [`TEST IMPORT ${tag}`, fixtures[0].contractId])).rows[0].id;
    const expectedNames = new Map(fixtures.map(row => [row.contractId, row.original]));
    expectedNames.set(importedId!, `TEST IMPORT ${tag}`);
    for (const fixture of fixtures) {
      const { lane, contractId, potentialId, messageId } = fixture;
      const check = async (name: string) => {
        expectedNames.set(contractId, name);
        const storedNames = await pool.query("select id, ten_khach_hang as name from crm.hop_dong where id = any($1::uuid[])", [[...expectedNames.keys()]]);
        for (const other of storedNames.rows) assert.equal(other.name, expectedNames.get(other.id), "other customers/lanes must not be renamed");
        const stored = await read(contractId);
        assert.equal(stored.name, name);
        assert.deepEqual(stored.frozen, fixture.frozen, "only the current customer name and update timestamp may change");
        for (const view of ["sale", "ops", "accounting"] as const) {
          const rows = await repo.listContracts(lane, false, view, { ...contractSearch, q: name });
          const contract = rows.find(row => row.id === contractId);
          assert.ok(contract, `${lane}/${fixture.desk}/${view}: searchable by corrected name`);
          assert.equal(contract.customerName, name);
          assert.equal(contract.totalValue, 120);
          assert.equal(contract.paidAmount, 30);
        }
      };
      const fromMess = `${fixture.original} MESS`;
      await repo.updateMessage(lane, messageId, updateMessageSchema.parse({ ...fixture.message, customerName: fromMess }));
      await check(fromMess);
      const fromPotential = `${fixture.original} LEAD`;
      await repo.updatePotential(lane, potentialId, updatePotentialSchema.parse({ fullName: fromPotential, companyName: "Separate company name", phone: fixture.message.phone, email: "", productInterest: "Sample goods", quantityNote: "2", address: "", saleNote: "Name sync test", potential: "POTENTIAL", customerKind: fixture.desk === "sourcing" ? "SOURCING" : "LOGISTICS", brand: fixture.message.brand, ...(fixture.desk === "logistics" ? { shippingMode: "AIR", weightKg: "2", shipToAddress: "US" } : {}) }));
      await check(fromPotential);
      const suffix = lane === "vn" ? "viet_nam" : "global";
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(`update crm.khach_hang_tiem_nang_${suffix} set ho_ten = $2 where id = $1::uuid`, [potentialId, `${fromPotential} ROLLBACK`]);
        assert.equal((await client.query("select ten_khach_hang from crm.hop_dong where id = $1::uuid", [contractId])).rows[0].ten_khach_hang, `${fromPotential} ROLLBACK`);
      } finally { await client.query("rollback"); client.release(); }
      await check(fromPotential);
    }
    const first = fixtures[0];
    await pool.query("update crm.khach_hang_tiem_nang_viet_nam set ho_ten = '   ' where id = $1::uuid", [first.potentialId]);
    assert.equal((await read(first.contractId)).name, `${first.original} LEAD`, "blank source must not erase a contract name");
    await pool.query("update crm.khach_hang_tiem_nang_viet_nam set ho_ten = $2 where id = $1::uuid", [first.potentialId, `${first.original} LEAD`]);

    const deleted = fixtures[fixtures.length - 1];
    await pool.query("update crm.khach_hang_tiem_nang_global set ho_ten = 'Deleted source name', xoa_luc = now() where id = $1::uuid", [deleted.potentialId]);
    assert.equal((await read(deleted.contractId)).name, `${deleted.original} LEAD`);
    await pool.query("update crm.hop_dong set ten_khach_hang = 'Stale contract name' where id = any($1::uuid[])", [fixtures.slice(0, -1).map(row => row.contractId)]);
    const migration = await readFile(new URL("../../db/migrations/051_hop_dong_ten_khach_hang.sql", import.meta.url), "utf8");
    await pool.query(migration);
    for (const fixture of fixtures) {
      const stored = await read(fixture.contractId);
      assert.equal(stored.name, `${fixture.original} LEAD`, "migration repairs names changed before deployment");
      assert.deepEqual(stored.frozen, fixture.frozen);
    }
    assert.equal((await read(importedId!)).name, `TEST IMPORT ${tag}`, "a VN quote ID is not a source for a Global contract");
  } finally {
    await pool.query("delete from crm.hop_dong where id = any($1::uuid[])", [[...fixtures.map(row => row.contractId), ...(importedId ? [importedId] : [])]]);
    for (const lane of ["vn", "global"] as const) {
      const suffix = lane === "vn" ? "viet_nam" : "global";
      const ids = potentials.filter(row => row.lane === lane).map(row => row.id);
      for (const desk of ["sourcing", "logistics"]) await pool.query(`delete from crm.bao_gia_${desk}_${suffix} where ma_khach_hang_tiem_nang = any($1::uuid[])`, [ids]);
      await pool.query(`delete from crm.khach_hang_tiem_nang_${suffix} where id = any($1::uuid[])`, [ids]);
      await pool.query(`delete from crm.tin_nhan_${suffix} where id = any($1::uuid[])`, [messages.filter(row => row.lane === lane).map(row => row.id)]);
    }
    await pool.end();
  }
});
