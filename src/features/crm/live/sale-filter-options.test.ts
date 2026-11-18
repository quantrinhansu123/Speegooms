import assert from "node:assert/strict";
import test from "node:test";
import { saleFilterOptions } from "./sale-filter-options";

const staff = ["Văn Thái Ngọc Hân", "Võ Thị Kim Quyên", "Nguyễn Thị Diệu Linh", "Trần Thị Thùy Linh", "Nguyễn Ngọc Trúc Ly"];

test("mỗi sale một họ tên đầy đủ, tên gõ tắt gộp vào đúng người", () => {
  const options = saleFilterOptions(staff, ["Hân", "Quyên", "Diệu Linh", "Văn Thái Ngọc Hân", "Trúc"]);
  assert.deepEqual(options.map((o) => o.label).sort(), [...staff].sort());
  const han = options.find((o) => o.label === "Văn Thái Ngọc Hân")!;
  assert.deepEqual(han.value.split("|"), ["Văn Thái Ngọc Hân", "Hân"]);
  assert.deepEqual(options.find((o) => o.label === "Nguyễn Thị Diệu Linh")!.value.split("|"), ["Nguyễn Thị Diệu Linh", "Diệu Linh"]);
  assert.deepEqual(options.find((o) => o.label === "Nguyễn Ngọc Trúc Ly")!.value.split("|"), ["Nguyễn Ngọc Trúc Ly", "Trúc"]);
});

test("tên mơ hồ hoặc không thuộc sale nào giữ thành lựa chọn riêng, không gộp bừa", () => {
  const options = saleFilterOptions(staff, ["Linh", "Nguyễn Văn An"]);
  assert.ok(options.some((o) => o.label === "Linh" && o.value === "Linh"));
  assert.ok(options.some((o) => o.label === "Nguyễn Văn An"));
  assert.equal(options.find((o) => o.label === "Trần Thị Thùy Linh")!.value, "Trần Thị Thùy Linh");
});

test("tên gõ tắt của sale tuyến khác vẫn gộp về họ tên đầy đủ, người không có mess thì không hiện", () => {
  const options = saleFilterOptions(["Trịnh Thị Mỹ Trâm"], ["Hân", "Quyên"], ["Văn Thái Ngọc Hân", "Võ Thị Kim Quyên", "Đỗ Thị Thu Trang"]);
  assert.deepEqual(options.map((o) => o.label), ["Trịnh Thị Mỹ Trâm", "Văn Thái Ngọc Hân", "Võ Thị Kim Quyên"]);
  assert.equal(options.find((o) => o.label === "Văn Thái Ngọc Hân")!.value, "Văn Thái Ngọc Hân|Hân");
});
