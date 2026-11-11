import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";
import { canHandleCrm, convertMessageSchema, createMessageSchema, quoteOrderSchema, updateMessageSchema, updatePotentialSchema, type PublicUser } from "@speego/shared";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { crmActor } from "../lib/crm-actor";
import { createApp } from "../app";
import { createContainer } from "../container";
import { loadEnv } from "./env";
import { ScryptPasswordHasher } from "../services/password.service";
import type { AddressInfo } from "node:net";

test("CRM handover gives the receiving Sale write access and keeps other desks' existing permissions", () => {
  const record = { handlerId: "sale-b" };
  assert.equal(canHandleCrm({ id: "sale-a", role: "sale-global" }, record), false);
  assert.equal(canHandleCrm({ id: "sale-b", role: "sale-global" }, record), true);
  assert.equal(canHandleCrm({ id: "admin", role: "admin" }, record), true);
  assert.equal(canHandleCrm({ id: "sourcing", role: "sourcing" }, record), true);
  assert.equal(canHandleCrm({ id: "sale-a", role: "sale-global" }, {}), true);
});

test("Mess insurance edits preserve contact entered during conversion on both lanes", { skip: !process.env.CRM_HANDOVER_TEST_URL }, async () => {
  const url = new URL(process.env.CRM_HANDOVER_TEST_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  const pool = new pg.Pool({ connectionString: url.toString() });
  const repo = new PostgresCrmRepository(pool);
  try {
    for (const lane of ["vn", "global"] as const) {
      const order = quoteOrderSchema.parse({ id: randomUUID(), name: "Insurance regression", selected: true, insurance: false,
        lines: [{ stt: "1", productName: "Goods", quantity: 2, pricePerSet: null, lineTotal: null, weightKg: 1, spec: "", note: "" }] });
      const input = createMessageSchema.parse({ customerName: `TEST-INSURANCE-${randomUUID()}`, phone: "", email: "", goods: "Goods", note: "", market: "US", saleName: "Test", painPoint: "", linkMess: "", demand: "SHIPPING", brand: "LOGISTICS", order });
      const message = await repo.createMessage(lane, input);
      let potentialId: string | undefined;
      try {
        const converted = await repo.convertMessage(lane, message.id, convertMessageSchema.parse({ phone: "0900000000", email: "contact@example.invalid", brand: "LOGISTICS", customerType: "INDIVIDUAL", careChannel: "FACEBOOK", productInterest: "Goods", address: "", saleNote: "Test", requirements: "Shipping", quantityNote: "2", reason: "Customer request", shippingMode: "AIR", packageDimensions: "10x10x10", weightKg: "2", shipToAddress: "US" }));
        assert.ok(typeof converted === "object");
        potentialId = converted.potential.id;
        await pool.query(`update crm.khach_hang_tiem_nang_${lane === "vn" ? "viet_nam" : "global"} set thu_dien_tu = $2 where id = $1`, [potentialId, "contact@example.invalid"]);
        const requested = await repo.requestQuote(lane, potentialId);
        assert.ok(typeof requested === "object");
        const saved = await repo.updateMessage(lane, message.id, updateMessageSchema.parse({ ...input, order: { ...order, insurance: true,
          lines: order.lines.map((line) => ({ ...line, pricePerSet: 150, lineTotal: 350, lineTotalManual: true })) } }));
        assert.equal(saved?.order?.insurance, true);
        assert.equal(saved?.order?.lines[0].pricePerSet, 150);
        assert.equal(saved?.order?.lines[0].lineTotal, 350);
        let lead = await pool.query(`select so_dien_thoai, thu_dien_tu from crm.khach_hang_tiem_nang_${lane === "vn" ? "viet_nam" : "global"} where id = $1`, [potentialId]);
        assert.deepEqual(lead.rows[0], { so_dien_thoai: "0900000000", thu_dien_tu: "contact@example.invalid" });
        assert.equal((await repo.findQuote(lane, "logistics", requested.quote.id))?.orders[0].insurance, true);
        assert.equal((await repo.findQuote(lane, "logistics", requested.quote.id))?.orders[0].lines[0].lineTotal, 350);
        await repo.updateMessage(lane, message.id, updateMessageSchema.parse({ ...input, phone: "0911111111", email: "updated@example.invalid" }));
        lead = await pool.query(`select so_dien_thoai, thu_dien_tu from crm.khach_hang_tiem_nang_${lane === "vn" ? "viet_nam" : "global"} where id = $1`, [potentialId]);
        assert.deepEqual(lead.rows[0], { so_dien_thoai: "0911111111", thu_dien_tu: "updated@example.invalid" });
      } finally {
        if (potentialId) await repo.deletePotential(lane, potentialId);
        await repo.deleteMessage(lane, message.id);
      }
    }
  } finally { await pool.end(); }
});

test("Postgres handover enforces ownership and preserves the real processor history", { skip: !process.env.CRM_HANDOVER_TEST_URL }, async () => {
  const url = new URL(process.env.CRM_HANDOVER_TEST_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "This write test requires an isolated local database");
  const pool = new pg.Pool({ connectionString: url.toString() });
  const repo = new PostgresCrmRepository(pool);
  const token = randomUUID();
  const user = (name: string, role: PublicUser["role"]): PublicUser => ({ id: `${token}-${name}`, name, role, email: `${token}-${name.replaceAll(" ", "-").toLowerCase()}@example.invalid`, department: "Test", title: "Test" });
  const a = user("Sale A", "sale-global");
  const b = user("Sale B", "sale-global");
  const wrongLane = user("Sale VN", "sale-vn");
  const admin = user("Admin", "admin");
  const messages: string[] = [];
  const potentials: string[] = [];
  const input = (name: string, handlerId?: string) => updatePotentialSchema.parse({ fullName: name, companyName: "", phone: "0900000000", email: "", productInterest: "Hàng mẫu", quantityNote: "", address: "US", saleNote: "Đã tư vấn", potential: "POTENTIAL", customerKind: "SOURCING", handlerId });
  const as = <T>(actor: PublicUser, action: () => Promise<T>) => crmActor.run(actor, action);
  try {
    const password = "local-fixture-only-123";
    const hash = await new ScryptPasswordHasher().hash(password);
    for (const actor of [a, b, wrongLane, admin]) await pool.query(`insert into public.nguoi_dung(ma_nguoi_dung, thu_dien_tu, ho_ten, vai_tro, phong_ban, chuc_danh, mat_khau_bam) values($1,$2,$3,$4,'Test','Test',$5)`, [actor.id, actor.email, actor.name, actor.role, hash]);
    const message = await as(a, () => repo.createMessage("global", createMessageSchema.parse({ customerName: "Khách bàn giao", phone: "0900000000", email: "", goods: "Hàng mẫu", demand: "SOURCING", note: "Tư vấn", market: "US", saleName: a.name, painPoint: "Cần tìm nguồn", linkMess: "", brand: "SPEEGO_US" }), a.id));
    messages.push(message.id);
    const converted = await as(a, () => repo.convertMessage("global", message.id, convertMessageSchema.parse({ phone: "0900000000", customerType: "INDIVIDUAL", careChannel: "FACEBOOK", productInterest: "Hàng mẫu", address: "US", saleNote: "Đã bàn giao", requirements: "Tìm hàng", handlerId: b.id })));
    assert.ok(typeof converted === "object");
    const leadId = converted.potential.id;
    potentials.push(leadId);
    assert.equal(converted.potential.handlerId, b.id);
    const history = await repo.potentialHistory("global", leadId);
    const handoverEvent = history.find(item => item.action === "handover")!;
    assert.equal(handoverEvent.actorName, a.name);
    assert.equal(handoverEvent.handlerName, b.name);
    assert.ok(history.some(item => item.entity === "message" && item.actorName === a.name));
    await assert.rejects(as(a, () => repo.updateMessage("global", message.id, updateMessageSchema.parse({ customerName: "Không được sửa nguồn", phone: "0900000000", email: "", goods: "Hàng mẫu", demand: "SOURCING", note: "", market: "US", saleName: a.name, painPoint: "", linkMess: "", brand: "SPEEGO_US" }))), { status: 403 });
    await assert.rejects(as(a, () => repo.updatePotential("global", leadId, input("Không được sửa", a.id))), { status: 403 });
    assert.equal((await repo.potentialHistory("global", leadId)).length, history.length);
    await as(b, () => repo.updatePotential("global", leadId, input("Sale B đã xử lý")));
    const quote = await as(b, () => repo.requestQuote("global", leadId));
    assert.ok(typeof quote === "object");
    assert.equal(quote.quote.handlerId, b.id);
    const afterCreate = (await repo.potentialHistory("global", leadId)).length;
    await as(b, () => repo.requestQuote("global", leadId));
    assert.equal((await repo.potentialHistory("global", leadId)).length, afterCreate, "opening an existing quote must not invent a create event");
    await assert.rejects(as(a, () => repo.updateQuoteOutcome("global", "sourcing", quote.quote.id, { nonCloseReason: "Không được sửa" })), { status: 403 });
    await as(b, () => repo.updateQuoteOutcome("global", "sourcing", quote.quote.id, { nonCloseReason: "Khách đang cân nhắc" }));
    assert.ok((await repo.potentialHistory("global", leadId)).some(item => item.entity === "quote" && item.actorName === b.name));
    await assert.rejects(as(b, () => repo.updatePotential("global", leadId, input("Sai tuyến", wrongLane.id))), { status: 400 });

    const env = loadEnv({ NODE_ENV: "test", DB_PROVIDER: "postgres", DATABASE_URL: url.toString(), DATABASE_SSL: "false", CORS_ORIGINS: "http://localhost:3000" });
    const container = await createContainer(env);
    const server = createApp(env, container).listen(0, "127.0.0.1");
    try {
      await new Promise<void>(resolve => server.once("listening", resolve));
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const login = async (actor: PublicUser) => {
        const csrf = await fetch(`${origin}/api/security/csrf`);
        const { token } = await csrf.json() as { token: string };
        let cookie = csrf.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
        const response = await fetch(`${origin}/api/auth/login`, { method: "POST", headers: { cookie, "x-csrf-token": token, "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ email: actor.email, password }) });
        assert.equal(response.status, 200);
        cookie += "; " + response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
        return { cookie, "x-csrf-token": token, "content-type": "application/json", origin: "http://localhost:3000" };
      };
      const headersA = await login(a);
      const headersB = await login(b);
      const path = `${origin}/api/crm/potentials/${leadId}?lane=global`;
      assert.equal((await fetch(path, { method: "PATCH", headers: headersA, body: JSON.stringify(input("Không được sửa")) })).status, 403);
      assert.equal((await fetch(path, { method: "PATCH", headers: headersB, body: JSON.stringify(input("B xử lý qua API")) })).status, 200);
      assert.equal((await repo.potentialHistory("global", leadId))[0].actorName, b.name, "request identity must reach the database audit");
      const historyRead = await fetch(`${origin}/api/crm/potentials/${leadId}/history?lane=global`, { headers: headersA });
      assert.equal(historyRead.status, 200);
      assert.ok(((await historyRead.json()) as { history: unknown[] }).history.length > 0);
      assert.equal((await fetch(path, { method: "PATCH", headers: headersB, body: JSON.stringify(input("B bàn giao lại A", a.id)) })).status, 200);
      const notice = await pool.query("select 1 from app.thong_bao where nguoi_nhan_id = $1 and loai = 'crm.handover'", [a.id]);
      assert.ok(notice.rowCount);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await container.close();
    }
    await as(admin, () => repo.updatePotential("global", leadId, input("Admin bàn giao lại", a.id)));
    await assert.rejects(as(b, () => repo.updateQuoteOutcome("global", "sourcing", quote.quote.id, { nonCloseReason: "Đã mất quyền" })), { status: 403 });
    await as(a, () => repo.updateQuoteOutcome("global", "sourcing", quote.quote.id, { nonCloseReason: "Người nhận mới xử lý" }));
    await pool.query("update public.nguoi_dung set ho_ten = 'Tên mới' where ma_nguoi_dung = $1", [a.id]);
    assert.ok((await repo.potentialHistory("global", leadId)).some(item => item.action === "handover" && item.actorName === "Sale A"));
    const creator = await pool.query("select nguoi_tao_id from crm.khach_hang_tiem_nang_global where id = $1", [leadId]);
    assert.equal(creator.rows[0].nguoi_tao_id, a.id);
  } finally {
    for (const id of potentials) await repo.deletePotential("global", id);
    for (const id of messages) await repo.deleteMessage("global", id);
    await pool.query("delete from crm.lich_su_xu_ly where khach_id = any($1::uuid[])", [potentials]);
    await pool.query("delete from public.nguoi_dung where ma_nguoi_dung = any($1::text[])", [[a.id, b.id, wrongLane.id, admin.id]]);
    await pool.end();
  }
});
