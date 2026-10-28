import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getBreadcrumbs } from "../../config/navigation.ts";
import { campaignSchema, candidateSchema, canApprove, canWrite, complaintSchema, complaintTransitionError, compensationSchema, employeeSchema, feedbackSchema, legalSchema, legalTransitions, sourceMetrics } from "./rules.ts";
import type { Complaint } from "../../types/backoffice.ts";

const metrics = sourceMetrics([
  { messId: "A", source: "ads", createdAt: "2026-10-01" },
  { messId: "B", source: "ads", createdAt: "2026-10-02" },
  { messId: "C", source: "google", createdAt: "2026-09-01" },
  { messId: "D", source: "organic", createdAt: "2026-10-28T12:00" },
], [{ messId: "A", status: "moi" }, { messId: "A", status: "da-chot" }, { messId: "B", status: "da-huy" }], [{ messId: "A", status: "da-ky" }, { messId: "A", status: "da-ky" }, { messId: "B", status: "huy" }], "2026-10-01", "2026-10-28");
assert.deepEqual(metrics[0], { source: "ads", leads: 2, rfq: 1, orders: 1, rfqRate: 50, orderRate: 50 });
assert.equal(metrics[1].leads, 0);
assert.equal(metrics[1].orderRate, 0);
assert.equal(metrics[2].leads, 1, "Ngày cuối bao gồm timestamp trong ngày");
assert.ok(sourceMetrics([], [], [], "2026-10-01", "2026-10-28").every((r) => r.rfqRate === 0));
assert.equal(canWrite("marketing", "marketing"), true);
assert.equal(canWrite("marketing", "feedback"), false);
assert.equal(canWrite("sale-vn", "feedback"), true);
assert.equal(canWrite("sale-global", "complaints"), false);
assert.equal(canWrite("hcns", "hrm"), true);
assert.equal(canWrite("ban-gd", "hrm"), false);
assert.equal(canApprove("ban-gd"), true);
assert.equal(canApprove("van-hanh"), false);
assert.equal(canWrite("phap-che", "legal"), true);
assert.equal(canWrite("hcns", "legal"), false);

const ticket = { status: "dang-xu-ly", compensation: { status: "chua" } } as Complaint;
assert.equal(complaintTransitionError(ticket, "hoan-tat", ""), "Cần nhập kết quả trước khi hoàn tất");
assert.equal(complaintTransitionError(ticket, "hoan-tat", "Đã xử lý"), null);
assert.ok(complaintTransitionError({ ...ticket, compensation: { amount: 1, reason: "a", status: "cho-duyet" } }, "hoan-tat", "Đã xử lý"));
assert.ok(complaintTransitionError({ ...ticket, status: "hoan-tat" }, "dang-xu-ly", ""));
assert.ok(!legalTransitions["dang-ra-soat"].includes("da-duyet"));
assert.ok(legalTransitions["tra-lai"].includes("dang-ra-soat"));
assert.deepEqual(legalTransitions["da-duyet"], []);

const complaint = { orderId: "DH-1", title: "Sự cố", description: "Mô tả", category: "Thiếu hàng", priority: "Cao", assigneeId: "u-vh", dueOn: "2026-10-30", evidence: "" };
assert.ok(complaintSchema.safeParse(complaint).success);
assert.ok(!complaintSchema.safeParse({ ...complaint, title: "   " }).success);
assert.ok(!complaintSchema.safeParse({ ...complaint, dueOn: "2026-02-30" }).success);
assert.ok(!complaintSchema.safeParse({ ...complaint, priority: "Invalid" }).success);
for (const amount of [-1, 0, Infinity, NaN, 1e13]) assert.ok(!compensationSchema.safeParse({ amount, reason: "a" }).success);
assert.ok(compensationSchema.safeParse({ amount: 100000, reason: "Bao bì hư hỏng" }).success);
assert.ok(!feedbackSchema.safeParse({ messId: "A", quality: "Tốt", note: " " }).success);
const employee = { name: "Lan", email: "lan@example.test", department: "hcns", position: "HR", managerId: "", joinedOn: "2026-10-01", status: "thu-viec", contractType: "Mock", contractEnd: "", documents: "" };
assert.ok(employeeSchema.safeParse(employee).success);
assert.ok(!employeeSchema.safeParse({ ...employee, email: "bad" }).success);
assert.ok(!employeeSchema.safeParse({ ...employee, contractEnd: "2026-09-01" }).success);
assert.ok(candidateSchema.safeParse({ name: "A", email: "a@example.test", department: "marketing", position: "Content", startOn: "2026-11-01" }).success);
assert.ok(!legalSchema.safeParse({ title: "a", refId: "DH-1", refType: "url", request: "a", assigneeId: "u-pc", dueOn: "2026-10-30" }).success);
assert.ok(!campaignSchema.safeParse({ name: "A", source: "ads", startOn: "2026-11-01", endOn: "2026-10-01", budget: 1, spent: 0 }).success);
for (const path of ["/marketing", "/marketing/chien-dich", "/phap-che", "/phap-che/yeu-cau/PL-0001", "/khieu-nai/KN-0001", "/fulfillment"]) {
  const crumbs = getBreadcrumbs(path);
  assert.equal(new Set(crumbs.map((c) => c.href)).size, crumbs.length, `Breadcrumb không được lặp: ${path}`);
  assert.equal(crumbs.at(-1)?.href, path);
}

// Bản ghi mẫu mới phải tham chiếu đúng đơn và người dùng hiện có.
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const contracts = read("../../mocks/crm/contracts.json") as { order_id: string }[];
assert.ok(["DH-2026-0001", "DH-2026-0002"].every((id) => contracts.some((c) => c.order_id === id)));
console.log("Backoffice checks passed: cohort conversion, permissions, transitions, form validation and seed references.");
