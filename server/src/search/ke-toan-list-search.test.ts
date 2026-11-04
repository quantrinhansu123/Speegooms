import assert from "node:assert/strict";
import test from "node:test";
import {
  createInternalExpenseSchema,
  createPaymentRequestSchema,
  createPayrollSchema,
  payrollNet,
} from "@speego/shared";
import { can } from "../config/permissions";
import { expenseSearch, paymentSearch, payrollSearch } from "./ke-toan-list-search";

const emptyPayment = { q: "", from: "", to: "", status: "", payeeKind: "", purpose: "" };

test("tìm đề nghị thanh toán theo nội dung thanh toán và các trường liên quan", () => {
  const compiled = paymentSearch({ ...emptyPayment, q: "cọc" }).build();
  for (const column of ["d.noi_dung_thanh_toan", "d.ma_hien_thi", "d.ma_don_hang", "d.nguoi_nhan", "d.ma_tham_chieu", "d.ten_khach_hang"]) {
    assert.match(compiled.sql, new RegExp(`${column.replace(".", "\\.")} ilike \\$1`));
  }
  assert.deepEqual(compiled.values, ["%cọc%"]);
});

test("đề nghị thanh toán lọc trạng thái, đối tượng, mục đích và ngày nhập", () => {
  const compiled = paymentSearch({ ...emptyPayment, status: "DA_CHI", payeeKind: "NHA_CUNG_CAP", purpose: "KHAC", from: "2026-10-01", to: "2026-10-31" }).build();
  assert.match(compiled.sql, /d\.trang_thai::text = /);
  assert.match(compiled.sql, /d\.doi_tuong_nhan::text = /);
  assert.match(compiled.sql, /d\.muc_dich::text = /);
  assert.deepEqual(compiled.values, ["2026-10-01", "2026-10-31", "DA_CHI", "NHA_CUNG_CAP", "KHAC"]);
});

test("không có bộ lọc thì không thêm điều kiện", () => {
  assert.equal(paymentSearch(emptyPayment).build().sql, "");
  assert.equal(payrollSearch({ q: "", from: "", to: "", department: "" }).build().sql, "");
  assert.equal(expenseSearch({ q: "", from: "", to: "", department: "", status: "" }).build().sql, "");
});

test("lương lọc theo kỳ và phòng ban, chi phí lọc theo ngày chi và trạng thái", () => {
  const payroll = payrollSearch({ q: "an", from: "2026-10-01", to: "2026-10-01", department: "Kế toán" }).build();
  assert.match(payroll.sql, /l\.ky >= \$2::date/);
  assert.match(payroll.sql, /l\.phong_ban = /);
  const expense = expenseSearch({ q: "", from: "", to: "2026-10-31", department: "", status: "CHO_DUYET" }).build();
  assert.match(expense.sql, /c\.ngay_chi <= \$1::date/);
  assert.deepEqual(expense.values, ["2026-10-31", "CHO_DUYET"]);
});

const validPayment = {
  orderCode: "HD-0001",
  payeeKind: "NHA_CUNG_CAP",
  purpose: "DAT_COC_XUONG",
  payeeName: "Xưởng ABC",
  content: "Đặt cọc đợt 1",
  amount: 5_000_000,
};

test("đề nghị thanh toán bắt buộc có nội dung thanh toán và số tiền dương", () => {
  assert.equal(createPaymentRequestSchema.safeParse(validPayment).success, true);
  assert.equal(createPaymentRequestSchema.safeParse({ ...validPayment, content: "   " }).success, false);
  assert.equal(createPaymentRequestSchema.safeParse({ ...validPayment, amount: 0 }).success, false);
  assert.equal(createPaymentRequestSchema.safeParse({ ...validPayment, payeeKind: "KHAC" }).success, false);
  const parsed = createPaymentRequestSchema.parse({ ...validPayment, content: "  Cọc  " });
  assert.equal(parsed.content, "Cọc");
  assert.equal(parsed.currency, "VND");
});

test("lương: khấu trừ không vượt lương cộng phụ cấp, thực nhận khớp công thức DB", () => {
  const base = { period: "2026-10", employeeCode: "NV01", fullName: "An", department: "Kế toán", baseSalary: 10_000_000 };
  assert.equal(createPayrollSchema.safeParse({ ...base, allowance: 500_000, insuranceDeduction: 1_050_000 }).success, true);
  assert.equal(createPayrollSchema.safeParse({ ...base, insuranceDeduction: 10_000_001 }).success, false);
  assert.equal(createPayrollSchema.safeParse({ ...base, period: "2026-13" }).success, false);
  assert.equal(payrollNet({ baseSalary: 10_000_000, allowance: 500_000, insuranceDeduction: 1_050_000 }), 9_450_000);
});

test("chi phí nội bộ cần ngày, hạng mục, nội dung và số tiền dương", () => {
  const ok = { spentOn: "2026-10-05", department: "hcns", category: "Văn phòng phẩm", content: "Giấy A4", amount: 200_000 };
  assert.equal(createInternalExpenseSchema.safeParse(ok).success, true);
  assert.equal(createInternalExpenseSchema.safeParse({ ...ok, amount: -1 }).success, false);
  assert.equal(createInternalExpenseSchema.safeParse({ ...ok, spentOn: "05/10/2026" }).success, false);
});

test("quyền kế toán: Kế toán và Vận hành nhập đề nghị, chỉ Kế toán nhập lương và chi phí", () => {
  assert.equal(can("ke-toan", "payment.create"), true);
  assert.equal(can("van-hanh", "payment.create"), true);
  assert.equal(can("marketing", "payment.create"), false);
  assert.equal(can("ke-toan", "payroll.write"), true);
  assert.equal(can("van-hanh", "payroll.write"), false);
  assert.equal(can("van-hanh", "payroll.read"), false);
  assert.equal(can("ke-toan", "expense.write"), true);
  assert.equal(can("sale-vn", "expense.read"), false);
});
