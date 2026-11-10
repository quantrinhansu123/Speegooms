import assert from "node:assert/strict";
import { test } from "node:test";
import type { PublicUser } from "@speego/shared";
import { CrmService } from "../services/crm.service";
import type { NotificationService } from "../services/notification.service";
import type { CrmRepository } from "../repositories/crm.repository";

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
  return { crm: new CrmService(crm, notifications, null, { assign }), calls };
}

test("chuyển Sourcing: chỉ người được chia nhận thông báo", async () => {
  const { crm, calls } = service(async () => ({ id: "u-ht", name: "Hương Thanh" }));
  await crm.handoffSourcingOrder("vn", quote.id, actor);
  assert.deepEqual(calls, ["assigned:u-ht"]);
});

test("không chia được (mọi người off hoặc lỗi) thì báo cả nhóm như cũ", async () => {
  for (const assign of [async () => null, async () => { throw new Error("db"); }]) {
    const { crm, calls } = service(assign);
    await crm.handoffSourcingOrder("vn", quote.id, actor);
    assert.deepEqual(calls, ["broadcast"]);
  }
});
