import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultQuoteBank, updateQuoteSchema, type PublicUser, type CrmLane, type QuoteDesk } from "@speego/shared";
import { CrmService } from "../services/crm.service";
import { NotificationService } from "../services/notification.service";
import type { CrmRepository, QuoteRecord } from "../repositories/crm.repository";
import type { NotificationDraft, NotificationRepository } from "../repositories/notification.repository";
import { crmActor } from "../lib/crm-actor";
import { quoteSearch } from "../search/crm-list-search";
import { sql } from "../search/sql-expression";
import { AssignmentController } from "../controllers/chia-don.controller";
import type { Request, Response } from "express";
import type { PostgresAssignmentRepository } from "../adapters/postgres/chia-don.repository";

const actor = { id: "u-svn", name: "Sale", role: "sale-vn" } as PublicUser;
const quote = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "BGS-1",
  customerKind: "SOURCING",
  quoteWorkflow: "COMBINED",
  orders: [{ lines: [{ productName: "Hàng", quantity: 5 }] }],
};

function service(assign: () => Promise<{ id: string; name: string } | null>) {
  const calls: string[] = [];
  const notifications = {
    notifyQuoteAssigned: async (_a: PublicUser, assigneeId: string) => { calls.push(`assigned:${assigneeId}`); },
    notifyQuoteRequested: async () => { calls.push("broadcast"); },
  } as unknown as NotificationService;
  const crm = { findQuote: async () => quote } as unknown as CrmRepository;
  return { crm: new CrmService(crm, notifications, null, { assign, assignees: async () => ({}) }), calls };
}

test("chuyển Sourcing: chỉ người được chia nhận thông báo", async () => {
  const { crm, calls } = service(async () => ({ id: "u-ht", name: "Hương Thanh" }));
  await crm.handoffSourcingOrder("vn", quote.id, actor);
  assert.deepEqual(calls, ["assigned:u-ht"]);
});

test("không chia được (mọi người off hoặc lỗi) thì dùng thông báo dự phòng", async () => {
  for (const assign of [async () => null, async () => { throw new Error("db"); }]) {
    const { crm, calls } = service(assign);
    await crm.handoffSourcingOrder("vn", quote.id, actor);
    assert.deepEqual(calls, ["broadcast"]);
  }
});

const search = { q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "" };
const input = updateQuoteSchema.parse({
  templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
  orders: [{ id: quote.id, name: "Đơn", selected: true, currency: "VND", rate: null,
    lines: [{ stt: "1", productName: "Ghế", quantity: 10, pricePerSet: 5, lineTotal: 50, weightKg: 2, unit: "cái", spec: "Gỗ", note: "" }] }],
  notes: { totalLabel: "", weightNote: "", validityNote: "", validityDays: 7, deposit: [] }, bank: defaultQuoteBank,
});
const current = { ...input, ...quote, sentQuote: null, logisticsSheet: null, createdAt: "2026-11-10" } as unknown as QuoteRecord;
const other = { ...current, id: "00000000-0000-4000-8000-000000000002" };
const worker = (role: "sourcing" | "logistics", id = "worker") => ({ id, name: id, role } as PublicUser);

function scopeService() {
  let writes = 0;
  const assignment = {
    assign: async () => ({ id: "worker", name: "Worker" }),
    assignees: async (lane: CrmLane, desk: QuoteDesk) => lane === "vn" ? {
      [current.id]: { id: "worker", name: `${desk} worker` },
      [other.id]: { id: "someone-else", name: "Other" },
    } : {},
  };
  const repo = {
    listQuotes: async (_lane: CrmLane, _desk: QuoteDesk, options: typeof search & { quoteIds?: string[] }) =>
      [current, other].filter((row) => !options.quoteIds || options.quoteIds.includes(row.id)),
    findQuote: async () => current,
    findQuoteByPotential: async () => ({ ...other, customerKind: "LOGISTICS" }),
    listPotentials: async () => [],
    listContracts: async () => [],
    updateQuote: async () => { writes++; return current; },
    sendQuote: async () => { writes++; return current; },
    requestLogisticsQuote: async () => { writes++; return { quote: current, created: true }; },
  } as unknown as CrmRepository;
  return { crm: new CrmService(repo, null, null, assignment), assignment, writes: () => writes };
}

test("nhân viên chỉ thấy phiếu được chia, tách đúng tuyến và cả phần theo dõi", async () => {
  const { crm } = scopeService();
  for (const role of ["sourcing", "logistics"] as const) {
    await crmActor.run(worker(role), async () => {
      assert.deepEqual((await crm.listQuotes("vn", role, search, role)).map((row) => row.id), [current.id]);
      assert.deepEqual(await crm.listQuotes("global", role, search, role), []);
      assert.deepEqual((await crm.getQuoteTracking("vn", "potential", role)).quotes.map((row) => row.id), [current.id]);
      assert.deepEqual((await crm.getQuoteTracking("global", "potential", role)).quotes, []);
    });
    await crmActor.run(worker(role, "unassigned"), async () => {
      assert.deepEqual(await crm.listQuotes("vn", role, search, role), []);
    });
  }
  for (const role of ["admin", "van-hanh", "ban-gd"] as const) {
    await crmActor.run({ id: role, role } as PublicUser, async () => {
      assert.equal((await crm.listQuotes("vn", "sourcing", search, role)).length, 2);
    });
  }
});

test("ID lấy từ URL không cho nhân viên sửa, gửi hoặc chuyển phiếu người khác", async () => {
  const { crm, writes } = scopeService();
  for (const role of ["sourcing", "logistics"] as const) {
    await crmActor.run(worker(role), async () => {
      for (const contentOnly of [false, true]) {
        await assert.rejects(crm.updateQuote("vn", role, other.id, input, { contentOnly, role }), { status: 404 });
      }
      await assert.rejects(crm.sendQuote("vn", role, other.id, input, worker(role)), { status: 404 });
    });
  }
  await crmActor.run(worker("sourcing"), async () => {
    await assert.rejects(crm.requestLogisticsQuote("vn", other.id, worker("sourcing")), { status: 404 });
  });
  await crmActor.run(worker("logistics"), async () => {
    await assert.rejects(crm.potentialLogisticsQuote("vn", "potential", "logistics"), { status: 404 });
  });
  assert.equal(writes(), 0);
  await crmActor.run(worker("sourcing"), async () => {
    await crm.updateQuote("vn", "sourcing", current.id, input, { contentOnly: false, role: "sourcing" });
  });
  assert.equal(writes(), 1);
});

test("không có nguồn phân công thì không mở rộng quyền nhân viên", async () => {
  await crmActor.run(worker("sourcing"), async () => {
    const crm = new CrmService({} as CrmRepository);
    await assert.rejects(crm.listQuotes("vn", "sourcing", search, "sourcing"), { status: 503 });
  });
});

test("phạm vi phiếu được đưa vào SQL trước giới hạn danh sách", () => {
  const compiled = quoteSearch({ ...search, q: "Ghế", quoteIds: [current.id] }, sql("q.status"), sql("q.contract")).build();
  assert.match(compiled.sql, /q\.id = any\(\$2::uuid\[\]\)/);
  assert.deepEqual(compiled.values, ["%Ghế%", [current.id]]);
});

test("API danh sách người phụ trách không lộ mã phiếu của người khác", async () => {
  const { assignment } = scopeService();
  const controller = new AssignmentController(assignment as unknown as PostgresAssignmentRepository);
  let body: unknown;
  const response = { status: () => response, json: (value: unknown) => { body = value; } } as unknown as Response;
  await controller.assignees({ user: worker("logistics"), params: { desk: "sourcing" }, query: { lane: "vn" } } as unknown as Request, response);
  assert.deepEqual(Object.keys((body as { assignees: object }).assignees), [current.id]);
});

function notificationRecorder() {
  const sent: { ids: readonly string[]; draft: NotificationDraft }[] = [];
  const repository = {
    listUserIdsByRoles: async (roles: readonly string[]) => roles,
    createMany: async (ids: readonly string[], draft: NotificationDraft) => { sent.push({ ids, draft }); return ids.length; },
  } as unknown as NotificationRepository;
  return { notifications: new NotificationService(repository), sent };
}

test("tạo RFQ chia đúng người và gửi thông báo có link bàn/tuyến ngay, mở lại không chia thêm", async () => {
  for (const lane of ["vn", "global"] as const) {
    for (const desk of ["sourcing", "logistics"] as const) {
      const { notifications, sent } = notificationRecorder();
      let created = true;
      const assigned: unknown[][] = [];
      const crm = new CrmService({ requestQuote: async () => {
        const result = { quote: current, desk, created }; created = false; return result;
      } } as unknown as CrmRepository, notifications, null, {
        assign: async (...args) => { assigned.push(args); return { id: "worker", name: "Worker" }; },
        assignees: async () => ({}),
      });
      await crm.requestQuote(lane, "potential", actor);
      await crm.requestQuote(lane, "potential", actor);
      assert.deepEqual(assigned, [[lane, desk, current.id]]);
      assert.deepEqual(sent.map((item) => item.ids), [["worker"]]);
      assert.equal(sent[0].draft.href, `/van-hanh/${desk}-bao-gia?id=${current.id}&lane=${lane}`);
    }
  }
});

test("Sourcing gửi lần đầu cũng chia người Logistics và thông báo khi repository tự bàn giao", async () => {
  for (const lane of ["vn", "global"] as const) {
    const { notifications, sent } = notificationRecorder();
    const assigned: QuoteDesk[] = [];
    const crm = new CrmService({ findQuote: async () => current, sendQuote: async () => current } as unknown as CrmRepository, notifications, null, {
      assign: async (_lane, desk) => { assigned.push(desk); return { id: "logistics-worker", name: "Logistics" }; },
      assignees: async () => ({}),
    });
    await crm.sendQuote(lane, "sourcing", current.id, input, { role: "admin", name: "Admin", id: "admin" } as PublicUser);
    assert.deepEqual(assigned, ["logistics"]);
    assert.deepEqual(sent.filter((item) => item.draft.type === "quote.request").map((item) => item.ids), [["logistics-worker"]]);
  }
});

test("yêu cầu làm lại báo đúng người, chưa có người thì chỉ báo quản lý", async () => {
  const { notifications, sent } = notificationRecorder();
  const crm = new CrmService({ returnQuote: async () => current } as unknown as CrmRepository, notifications, null, {
    assign: async () => ({ id: "worker", name: "Worker" }), assignees: async () => ({}),
  });
  await crm.returnQuote("vn", "sourcing", current.id, actor);
  assert.deepEqual(sent[0].ids, ["worker"]);
  assert.equal(sent[0].draft.type, "quote.return");
  await notifications.notifyQuoteRequested(actor, "vn", "sourcing", current.code, current.id, "SOURCING");
  await notifications.notifyQuoteReturned(actor, "global", "logistics", current.code, current.id, "LOGISTICS");
  assert.deepEqual(sent.slice(1).map((item) => item.ids), [["admin", "van-hanh"], ["admin", "van-hanh"]]);
});
