// Chạy: node --experimental-strip-types src/features/dashboard/metrics.check.ts
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { computeMetrics, resolveRange } from "./metrics.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../../mocks/data/${f}.json`, import.meta.url), "utf8"));
const data = {
  today: "2026-10-28",
  customers: read("customers"),
  leads: read("leads"),
  rfqs: read("rfqs"),
  orders: read("orders"),
  tasks: read("tasks"),
};

const r = resolveRange("7d", data.today);
assert.equal(r.from, "2026-10-22");
assert.equal(r.prevTo, "2026-10-21");
assert.equal(resolveRange("month", data.today).from, "2026-10-01");

const all = computeMetrics(data, "90d", "all");
const vn = computeMetrics(data, "90d", "sale-vn");
const gl = computeMetrics(data, "90d", "sale-global");
// Tuyến VN + Global phải cộng lại thành toàn công ty
assert.equal(vn.kpis.newLeads.value + gl.kpis.newLeads.value, all.kpis.newLeads.value);
assert.equal(vn.kpis.contractValue.value + gl.kpis.contractValue.value, all.kpis.contractValue.value);
// Phễu không tăng dần
assert.ok(all.funnel.leads >= all.funnel.rfqs && all.funnel.rfqs >= all.funnel.orders);
assert.ok(all.attentionOrders.every(({ order }) => order.attention));
console.log("metrics ok");
