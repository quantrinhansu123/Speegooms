import assert from "node:assert/strict";
import test from "node:test";
import { isLogisticsHandedOff, LOGISTICS_HANDED_OFF_SQL } from "../adapters/postgres/logistics-handoff";

const emptySheet = {
  templateId: null, opsNote: "", quoteStatus: "CHUA_CO_BAO_GIA", contractStatus: "CHUA_TAO",
  orders: [], notes: {}, bank: {}, sentQuote: null,
};

test("khách Sourcing kết hợp: Sale báo giá cho Sourcing thì Logistics chưa có bản ghi", () => {
  assert.equal(isLogisticsHandedOff(null, null), false);
  // Phiếu rỗng tạo sẵn lúc Sale yêu cầu báo giá (dữ liệu cũ) không tính là đã chuyển.
  assert.equal(isLogisticsHandedOff(emptySheet, null), false);
  assert.equal(isLogisticsHandedOff({ ...emptySheet, quoteStatus: "" }, null), false);
});

test("Logistics có bản ghi khi Sourcing đã chuyển sang", () => {
  // Sourcing bấm Gửi qua Logistics: có dấu handoffAt dù chưa có đơn hàng.
  assert.equal(isLogisticsHandedOff({ ...emptySheet, handoffAt: "2026-11-04T08:00:00.000Z" }, null), true);
  // Sourcing đã gửi báo giá: lúc gửi cũng chuyển cho Logistics.
  assert.equal(isLogisticsHandedOff(emptySheet, { sentAt: "2026-11-04T08:00:00.000Z" }), true);
  assert.equal(isLogisticsHandedOff(null, { sentAt: "2026-11-04T08:00:00.000Z" }), true);
  // Phiếu đã có đơn hàng, báo giá đã gửi hoặc đổi trạng thái.
  assert.equal(isLogisticsHandedOff({ ...emptySheet, orders: [{}] }, null), true);
  assert.equal(isLogisticsHandedOff({ ...emptySheet, sentQuote: { sentAt: "x" } }, null), true);
  assert.equal(isLogisticsHandedOff({ ...emptySheet, quoteStatus: "DA_CO_BAO_GIA" }, null), true);
});

test("điều kiện SQL cùng quy tắc với bản TypeScript", () => {
  for (const part of ["q.ban_da_gui is not null", "'handoffAt'", "'orders'", "'sentQuote'", "'quoteStatus'"]) {
    assert.ok(LOGISTICS_HANDED_OFF_SQL.includes(part), part);
  }
});
