import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  cumulativeProcessingCounts, isTargetPeriodStart, manageableTargetDepartments, roleSchema, saleTargetMetrics, setTargetsSchema,
  targetCompletion, targetQuerySchema, weekShareOfMonth, type SalesPerformanceReport, type TargetMember,
} from "@speego/shared";
import { performanceRows } from "@/features/reports/sales-report-metrics";
import { targetReportRows, type TargetReportData } from "@/features/marketing/target-report-model";
import { buildTargetTemplate, parseTargetSheet, parseTargetWorkbook } from "./targets-excel";

const members: TargetMember[] = [{ id: "u1", name: "An" }, { id: "u2", name: "Bình" }];
const metrics = [...saleTargetMetrics];
const [selfSourced, , quoteRate, , revenue] = metrics;

test("month starts on the 1st and week starts on Sunday", () => {
  assert.equal(isTargetPeriodStart("month", "2026-11-01"), true);
  assert.equal(isTargetPeriodStart("month", "2026-11-02"), false);
  assert.equal(isTargetPeriodStart("week", "2026-11-22"), true); // Chủ nhật
  assert.equal(isTargetPeriodStart("week", "2026-11-23"), false);
  assert.equal(targetQuerySchema.safeParse({ department: "sale-vn", period: "week", start: "2026-11-23" }).success, false);
  assert.equal(targetQuerySchema.safeParse({ department: "sale-vn", period: "week", start: "2026-11-22" }).success, true);
  assert.equal(targetQuerySchema.safeParse({ department: "kho", period: "month", start: "2026-11-01" }).success, false);
});

test("saving rejects negative values and unknown fields; null clears a cell", () => {
  const base = { department: "sale-vn", period: "month", start: "2026-11-01" };
  assert.equal(setTargetsSchema.safeParse({ ...base, rows: [{ userId: "u1", code: "SALE_REVENUE_VND", value: -1 }] }).success, false);
  assert.equal(setTargetsSchema.safeParse({ ...base, rows: [{ userId: "u1", code: "SALE_REVENUE_VND", value: 5, extra: 1 }] }).success, false);
  assert.equal(setTargetsSchema.safeParse({ ...base, rows: [{ userId: "u1", code: "SALE_REVENUE_VND", value: null }] }).success, true);
  assert.equal(setTargetsSchema.safeParse({ ...base, start: "2026-11-05", rows: [] }).success, false);
});

test("who may assign targets to which team", () => {
  const allowed = Object.fromEntries(roleSchema.options.map((role) => [role, manageableTargetDepartments(role)]));
  assert.deepEqual(allowed.admin, ["sale-vn", "sale-global", "marketing"]);
  assert.deepEqual(allowed["ban-gd"], ["sale-vn", "sale-global", "marketing"]);
  assert.deepEqual(allowed["sale-global-lead"], ["sale-global"]);
  assert.deepEqual(allowed["marketing-lead"], ["marketing"]);
  for (const role of ["sale-vn", "sale-global", "marketing", "marketing-content", "ke-toan", "hcns", "sale-intern"]) assert.deepEqual(allowed[role], [], role);
});

test("a week takes its share of the monthly target by days (week crossing two months)", () => {
  // Tuần 23/11–29/11 nằm trọn trong tháng 11 (30 ngày): 7/30 của 3000 = 700.
  assert.equal(Math.round(weekShareOfMonth("2026-11-22", (month) => (month === "2026-11-01" ? 3000 : undefined))!), 700);
  // Tuần vắt qua hai tháng: 3 ngày cuối tháng 10 (31 ngày) + 4 ngày đầu tháng 11 (30 ngày).
  const crossing = weekShareOfMonth("2026-10-29", (month) => (month === "2026-10-01" ? 3100 : month === "2026-11-01" ? 3000 : undefined));
  // 3 ngày × 3100/31 + 4 ngày × 3000/30 = 300 + 400 = 700.
  assert.equal(Math.round(crossing!), 700);
  assert.equal(weekShareOfMonth("2026-11-22", () => undefined), undefined);
});

test("the downloaded template imports back exactly what was filled", () => {
  const book = buildTargetTemplate({ month: "2026-11-01", week: "2026-11-22" }, members, metrics);
  assert.deepEqual(book.SheetNames, ["Tháng", "Tuần", "Hướng dẫn"]);
  const sheet = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets["Tháng"]!, { header: 1 });
  assert.equal(sheet[0]![0], "Mã nhân viên");
  assert.equal(sheet.length, 3);
  // Điền mẫu: An 10 khách tự tìm + 2.500.000 doanh số; Bình để trống.
  const header = sheet[0] as string[];
  const filled = XLSX.utils.aoa_to_sheet([
    header,
    ["u1", "An", "2026-11-01", ...metrics.map((metric) => (metric.code === selfSourced!.code ? 10 : metric.code === revenue!.code ? "2.500.000" : ""))],
    ["u2", "Bình", "2026-11-01", ...metrics.map(() => "")],
  ]);
  book.Sheets["Tháng"] = filled;
  const result = parseTargetWorkbook(book, members, metrics);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows.map(({ userId, code, value }) => [userId, code, value]), [["u1", selfSourced!.code, 10], ["u1", revenue!.code, 2_500_000]]);
});

test("import reports every bad row instead of skipping silently", () => {
  const header = ["Mã nhân viên", "Họ tên", "Ngày bắt đầu kỳ (yyyy-mm-dd)", ...metrics.map((metric) => `${metric.name} (${metric.unit})`)];
  const blank = metrics.map(() => "");
  const at = (code: string, value: unknown) => metrics.map((metric) => (metric.code === code ? value : ""));
  const parsed = parseTargetSheet("month", [
    header,
    ["u9", "Lạ", "2026-11-01", ...blank],                                 // người không thuộc nhóm
    ["u1", "An", "2026-11-15", ...at(selfSourced!.code, 5)],               // không phải mùng 1
    ["u1", "An", "2026-11-01", ...at(quoteRate!.code, 150)],               // tỷ lệ > 100
    ["u2", "Bình", "2026-11-01", ...at(selfSourced!.code, "abc")],         // không phải số
    ["u2", "Bình", "2026-11-01", ...at(selfSourced!.code, -3)],            // âm
    ["u2", "Bình", "2026-11-01", ...at(selfSourced!.code, 7)],             // hợp lệ
    ["u2", "Bình", "2026-11-01", ...at(selfSourced!.code, 8)],             // trùng
  ], members, metrics);
  assert.equal(parsed.rows.length, 1);
  assert.deepEqual(parsed.rows[0], { period: "month", start: "2026-11-01", userId: "u2", code: selfSourced!.code, value: 7 });
  assert.equal(parsed.errors.length, 6);
  assert.match(parsed.errors[0]!, /Dòng 2.*u9/);
  assert.match(parsed.errors[1]!, /Dòng 3.*mùng 1/);
  assert.match(parsed.errors[2]!, /Dòng 4.*0–100/);
  assert.match(parsed.errors[3]!, /Dòng 5.*abc/);
  assert.match(parsed.errors[4]!, /Dòng 6/);
  assert.match(parsed.errors[5]!, /Dòng 8.*đã có/);
  assert.ok(parseTargetSheet("month", [["sai", "cột"]], members, metrics).errors[0]!.includes("file mẫu"));
  assert.ok(parseTargetWorkbook(XLSX.utils.book_new(), members, metrics).errors[0]!.includes("file mẫu"));
});

test("personal targets drive the Sale report; people without one fall back to the department KPI", () => {
  const sale = (id: string) => ({ id, name: id, department: "sale-vn" as const });
  const zero = { selfSourced: 0, potentials: 0, quoted: 0, closed: 0, revenue: 0, missingRates: 0 };
  const report: SalesPerformanceReport = {
    members: [sale("u1"), sale("u2")],
    headcounts: { "sale-vn": 2, "sale-global": 0 },
    definitions: [{ id: "k1", version: 1, department: "sale-vn", group: "Sale", code: "SALE_SELF_SOURCED", name: "Tự tìm", unit: "khách", target: 60, period: "month", active: true }],
    rows: [{ id: "u1", current: { ...zero, selfSourced: 8 }, previous: zero }, { id: "u2", current: { ...zero, selfSourced: 4 }, previous: zero }],
    targets: { u1: { SALE_SELF_SOURCED: 10, SALE_QUOTE_RATE: 40 }, u2: { SALE_QUOTE_RATE: 60 } },
  };
  const november = { start: "2026-11-01", end: "2026-12-01" };
  const row = (members: ReturnType<typeof sale>[], key: string) => performanceRows(report, members, november).rows.find((item) => item.key === key)!;
  // u1 có mục tiêu riêng 10; u2 chưa có → KPI phòng 60/tháng chia 2 Sale, cả tháng = 30.
  assert.equal(row([sale("u1")], "selfSourced").target, 10);
  assert.equal(Math.round(row([sale("u2")], "selfSourced").target!), 30);
  assert.equal(Math.round(row([sale("u1"), sale("u2")], "selfSourced").target!), 40);
  assert.equal(row([sale("u1")], "selfSourced").completion, 80);
  // Tỷ lệ: nhóm lấy trung bình mục tiêu từng người.
  assert.equal(row([sale("u1"), sale("u2")], "quoteRate").target, 50);
  // Không ai có mục tiêu hay KPI phòng cho chỉ tiêu này → để trống.
  assert.equal(row([sale("u1")], "closeRate").target, null);
});

test("cumulative Mess levels roll up from the higher levels: L1..L4 include L6, L5 skips it, L6 stays alone", () => {
  // L1=1 … L8=8 để mỗi mức đóng góp một giá trị riêng; L0 không tính.
  const sum = cumulativeProcessingCounts({ L0: 99, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5, L6: 6, L7: 7, L8: 8 });
  assert.equal(sum.L1, 36);
  assert.equal(sum.L2, 35);
  assert.equal(sum.L3, 33);
  assert.equal(sum.L4, 30);
  assert.equal(sum.L5, 20);
  assert.equal(sum.L6, 6);
  assert.equal(sum.L7, 15);
  assert.equal(sum.L8, 8);
  assert.equal("L0" in sum, false);
  assert.deepEqual(cumulativeProcessingCounts({}), { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0, L7: 0, L8: 0 });
});

test("completion: minimum KPIs divide result by target, maximum KPIs (costs) divide target by result", () => {
  assert.equal(targetCompletion(180, 250), 72);
  assert.equal(targetCompletion(300, 250), 120);
  assert.equal(targetCompletion(0, 250), 0);
  assert.equal(targetCompletion(140_000, 140_000, "at-most"), 100);
  assert.equal(targetCompletion(280_000, 140_000, "at-most"), 50);
  assert.equal(targetCompletion(0, 140_000, "at-most"), 100); // chi phí 0: đạt trọn
  assert.equal(targetCompletion(10, undefined), null);        // chưa giao mục tiêu
  assert.equal(targetCompletion(10, 0), null);                // mục tiêu 0 không chia
});

test("Marketing report rows: per person, only KPIs with a target or a result; group row for 2+ people", () => {
  const metric = (code: string, direction: "at-least" | "at-most") => ({ code, name: code, unit: "x", direction, active: true });
  const report: TargetReportData = {
    members: [{ id: "a", name: "An" }, { id: "b", name: "Bình" }, { id: "c", name: "Chi" }],
    metrics: [metric("MESS", "at-least"), metric("COST", "at-most"), metric("SEO", "at-least")],
    targets: { a: { MESS: 250, COST: 140_000 }, b: { MESS: 150, COST: 100_000 } },
    results: { a: { MESS: { actual: 200, tasks: 2 }, COST: { actual: 160_000, tasks: 2 } }, b: { MESS: { actual: 90, tasks: 1 } }, c: { SEO: { actual: 7, tasks: 1 } } },
  };
  // Một người: chỉ KPI có mục tiêu hoặc kết quả, không có dòng nhóm.
  const one = targetReportRows(report, ["a"]);
  assert.deepEqual(one.map((row) => row.key), ["a|MESS", "a|COST"]);
  assert.equal(one[0]!.completion, 80);                     // 200/250
  assert.equal(Math.round(one[1]!.completion!), 88);        // tối đa: 140000/160000
  // Tất cả: Chi chỉ có kết quả, không có mục tiêu -> không có %.
  const all = targetReportRows(report, null);
  const chi = all.find((row) => row.key === "c|SEO")!;
  assert.equal(chi.target, undefined);
  assert.equal(chi.completion, null);
  // Nhóm 2 người (An, Bình): KPI tối thiểu cộng, KPI tối đa trung bình trên người có số.
  const group = targetReportRows(report, ["a", "b"]).filter((row) => row.member === "Tổng nhóm");
  const mess = group.find((row) => row.metric.code === "MESS")!;
  assert.deepEqual([mess.target, mess.actual, mess.tasks], [400, 290, 3]);
  assert.equal(mess.completion, 72.5);
  const cost = group.find((row) => row.metric.code === "COST")!;
  assert.deepEqual([cost.target, cost.actual], [120_000, 160_000]); // trung bình mục tiêu; kết quả chỉ An có
  assert.equal(group.some((row) => row.metric.code === "SEO"), false);
  assert.equal(targetReportRows(report, ["a"]).some((row) => row.member === "Tổng nhóm"), false);
});
