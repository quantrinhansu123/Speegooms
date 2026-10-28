import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildReport, type ReportInput } from "./rules.ts";
import { snapshotFromDto, camelizeKeys } from "../crm/adapters.ts";
import { canViewReport, reportConfig, type ReportKey } from "../../config/reports.ts";
import { canPerform } from "../../config/permissions.ts";
import { toCsv } from "../../lib/csv.ts";
import type { CrmSnapshotDto } from "../../types/crm.ts";
import type { OpsSnapshot } from "../../types/ops.ts";
import type { FulfillmentSnapshot } from "../../types/fulfillment.ts";
import type { AccountingSnapshot } from "../../types/accounting.ts";

const read = (module: string, file: string) => JSON.parse(readFileSync(new URL(`../../mocks/${module}/${file}.json`, import.meta.url), "utf8"));
const crm = snapshotFromDto(Object.fromEntries(["staff", "customers", "leads", "interactions", "rfqs", "quotations", "contracts"].map((f) => [f, read("crm", f)])) as unknown as CrmSnapshotDto);
const input: ReportInput = {
  crm,
  ops: camelizeKeys<OpsSnapshot>(Object.fromEntries(["staff", "suppliers", "partners", "requests", "supplier-quotes", "pos", "orders", "shipments", "tracking-events", "documents", "history"].map((f) => [f.replaceAll("-", "_"), read("ops", f)]))),
  wh: camelizeKeys<FulfillmentSnapshot>(Object.fromEntries(["warehouses", "receipts", "packages", "outbounds", "deliveries", "inquiries"].map((f) => [f, read("fulfillment", f)]))),
  acc: camelizeKeys<AccountingSnapshot>({ statement_lines: read("accounting", "statement-lines"), customer_receipts: read("accounting", "customer-receipts"), payments: read("accounting", "payments"), settlements: read("accounting", "settlements") }),
  today: "2026-10-28",
};
for (const key of Object.keys(reportConfig) as ReportKey[]) {
  const report = buildReport(input, key, "admin", "2026-07-01", "2026-10-28");
  assert.ok(report.columns.length && report.rows.length, `Report ${key} cần dữ liệu mẫu`);
  assert.ok(!report.rows.some((r) => Object.values(r).some((v) => typeof v === "number" && !Number.isFinite(v))));
  assert.equal(buildReport(input, key, "hcns", "2026-07-01", "2026-10-28").rows.length, 0);
  assert.equal(buildReport(input, key, "admin", "2026-10-30", "2026-07-01").rows.length, 0);
  assert.equal(buildReport(input, key, "admin", "2026-02-30", "2026-10-28").rows.length, 0);
}
assert.equal(canViewReport("marketing", "debts"), false);
assert.equal(canViewReport("sale-vn", "suppliers"), false);
assert.equal(canPerform("admin", "deposit.confirm"), false);
assert.equal(canPerform("ke-toan", "deposit.confirm"), true);
assert.equal(canPerform("sale-global", "quote.review"), true);
const vnOrders = buildReport(input, "orders", "sale-vn", "2026-07-01", "2026-10-28");
assert.ok(vnOrders.rows.every((r) => r.route === "Sale Việt Nam"));
const globalSales = buildReport(input, "sales", "sale-global", "2026-07-01", "2026-10-28");
assert.ok(globalSales.rows.every((r) => r.route === "Sale Global"));
const first = crm.leads.find((l) => l.source === "ads")!;
const cohort: ReportInput = { ...input, crm: { ...crm, leads: [first], rfqs: [{ ...crm.rfqs[0], messId: first.messId, status: "da-co-gia" }, { ...crm.rfqs[0], messId: first.messId, status: "da-co-gia" }], contracts: [{ ...crm.contracts[0], messId: first.messId, status: "da-ky" }, { ...crm.contracts[0], messId: first.messId, status: "huy" }] } };
const row = buildReport(cohort, "conversion", "admin", "2026-01-01", "2026-12-31").rows.find((r) => r.id === "ads")!;
assert.equal(row.leads, 1); assert.equal(row.rfq, 1); assert.equal(row.orders, 1); assert.equal(row.orderRate, 100);
const noDeadlines = { ...input, ops: { ...input.ops, orders: [] } };
const ontime = buildReport(noDeadlines, "ontime", "admin", "2026-01-01", "2026-12-31");
assert.ok(ontime.rows.every((r) => r.result === "Chưa có hạn"));
assert.match(ontime.summary!, /Chưa đủ/);
const csv = toCsv(["Tên", "Ghi chú", "Số"], [["Tiếng Việt", 'Có "ngoặc", dấu phẩy\nvà dòng mới', -2], ["  =SUM(A1:A2)", "\t+CMD", 0]]);
assert.ok(csv.startsWith("\uFEFF"));
assert.ok(csv.includes('"Có ""ngoặc"", dấu phẩy\nvà dòng mới"'));
assert.ok(csv.includes('"\'  =SUM(A1:A2)"'));
assert.ok(csv.includes('"\'\t+CMD"'));
assert.ok(csv.includes('"-2"'));
assert.ok(csv.includes("\r\n"));
console.log("PASS: 8 reports, role/route scopes, cohort deduplication, empty denominators, date validation and safe UTF-8 CSV.");
