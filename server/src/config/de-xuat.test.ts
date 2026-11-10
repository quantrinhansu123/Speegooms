import assert from "node:assert/strict";
import { test } from "node:test";
import { leaveDayCount, proposalDetailSchemas, proposalPeriodRange } from "@speego/shared";

test("chu kỳ hạn mức: tuần bắt đầu thứ Hai, tháng, năm", () => {
  const sunday = new Date(2026, 10, 15); // CN 15/11/2026
  assert.deepEqual(proposalPeriodRange("week", sunday), { start: new Date(2026, 10, 9), end: new Date(2026, 10, 16) });
  assert.deepEqual(proposalPeriodRange("month", sunday), { start: new Date(2026, 10, 1), end: new Date(2026, 11, 1) });
  assert.deepEqual(proposalPeriodRange("year", sunday), { start: new Date(2026, 0, 1), end: new Date(2027, 0, 1) });
});

test("số ngày nghỉ tính cả ngày cuối, nửa ngày = 0,5", () => {
  assert.equal(leaveDayCount("2026-11-10", "2026-11-12", "full"), 3);
  assert.equal(leaveDayCount("2026-11-10", "2026-11-10", "half"), 0.5);
});

test("trường riêng từng loại đề xuất", () => {
  assert.equal(proposalDetailSchemas["cham-cong"].safeParse({ date: "2026-11-10" }).success, false); // thiếu giờ
  assert.equal(proposalDetailSchemas["cham-cong"].safeParse({ date: "2026-11-10", checkIn: "08:30" }).success, true);
  assert.equal(proposalDetailSchemas["di-muon-ve-som"].safeParse({ date: "2026-02-30", type: "di-muon", time: "09:10" }).success, false);
  assert.equal(proposalDetailSchemas["thanh-toan"].safeParse({ amount: 0, payee: "A" }).success, false);
  assert.equal(proposalDetailSchemas["nghi-phep"].safeParse({ startDate: "2026-11-12", endDate: "2026-11-10", leaveType: "phep-nam", duration: "full" }).success, false);
});
