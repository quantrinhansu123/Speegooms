import assert from "node:assert/strict";
import test from "node:test";
import { resolveHref } from "./notification-menu";
import type { AppNotification } from "./types";

test("Customer handover notifications open the recipient's sales route, including old links", () => {
  const item: AppNotification = {
    id: "notification", recipientId: "sale", actorId: null, type: "datalanh.handover",
    title: "", body: "", href: "/sale-viet-nam/data-lanh?keep=1", lane: null,
    refType: "data-lanh", refId: "customer", read: false, readAt: null, createdAt: "",
  };
  assert.equal(resolveHref(item, "sale-global-lead"), "/sale-global/data-lanh?keep=1&id=customer");
  assert.equal(resolveHref(item, "sale-global"), "/sale-global/data-lanh?keep=1&id=customer");
  for (const role of ["sale-vn", "sale-intern", "admin", "ban-gd"] as const) {
    assert.equal(resolveHref(item, role), "/sale-viet-nam/data-lanh?keep=1&id=customer");
  }
  assert.equal(resolveHref({ ...item, href: "/sale-global/rfq", refType: "quote", lane: "global" }, "sale-global"), "/sale-global/rfq?id=customer&lane=global");
});
