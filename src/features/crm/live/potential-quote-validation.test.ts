import assert from "node:assert/strict";
import { test } from "node:test";
import { missingQuoteFields } from "./potential-quote-validation.ts";

const complete = {
  customerKind: "LOGISTICS",
  fullName: "Nguyễn Văn A",
  companyName: "Công ty A",
  phone: "0900000000",
  email: "a@example.com",
  brand: "LOGISTICS",
  potential: "POTENTIAL",
  customerType: "ENTERPRISE",
  productInterest: "Hàng mẫu",
  quantityNote: "10 kiện",
  address: "123 Main Street",
  saleNote: "Gọi lại ngày mai",
  careChannel: "ZALO",
  classification: "LCL",
  packageDimensions: "40 x 30 x 20 cm",
  weightKg: "20 kg",
  logisticsClass: "LCL",
  shippingMode: "SEA" as const,
  shipFromAddress: null,
  shipToAddress: "123 Main Street",
  requirements: "Giao trước thứ sáu",
  convertReason: "Cần báo giá",
};

test("Logistics quote still requires weight and receiving address", () => {
  assert.deepEqual(missingQuoteFields(complete), []);
  assert.deepEqual(missingQuoteFields({ ...complete, companyName: " ", weightKg: "  ", shipToAddress: null }), [
    "Trọng lượng",
    "Địa chỉ nhận hàng",
  ]);
});

test("Logistics quote accepts blank company, email and customer address", () => {
  for (const value of [null, "", "  "]) {
    assert.deepEqual(missingQuoteFields({ ...complete, companyName: value, email: value, address: value }), []);
  }
});

test("other logistics profile fields remain required", () => {
  const blank = {
    ...complete,
    fullName: "",
    phone: "",
    brand: "",
    potential: "",
    customerType: "",
    productInterest: "",
    quantityNote: "",
    address: "",
    saleNote: "",
    careChannel: "",
    weightKg: "",
    shipToAddress: "",
    requirements: "",
    convertReason: "",
    packageDimensions: "",
    logisticsClass: "",
  };
  assert.deepEqual(missingQuoteFields(blank), [
    "Tên khách",
    "Số điện thoại",
    "Nguồn",
    "Giai đoạn",
    "Đối tượng",
    "Hàng hóa",
    "Số lượng",
    "Ghi chú sale",
    "Kênh chăm sóc",
    "Trọng lượng",
    "Địa chỉ nhận hàng",
    "Yêu cầu của khách",
    "Lý do chuyển",
    "LCL/FCL",
    "Kích thước kiện hàng",
  ]);
});

test("Logistics quote requires a shipping mode", () => {
  assert.deepEqual(missingQuoteFields({ ...complete, shippingMode: null }), ["Phương thức vận chuyển"]);
});

test("conversion accepts a blank customer address but still requires a shipping destination", async () => {
  const { convertMessageSchema } = await import("@speego/shared");
  const base = { phone: "0900000000", customerType: "INDIVIDUAL", careChannel: "ZALO", productInterest: "Goods", address: "", saleNote: "Note", requirements: "Requirements" };
  assert.equal(convertMessageSchema.safeParse(base).success, true);
  assert.deepEqual(missingQuoteFields({ ...complete, customerKind: "SOURCING", address: "" }), []);
  const shipping = { ...base, shippingMode: "AIR", weightKg: "10", quantityNote: "1", packageDimensions: "10x10x10", reason: "Ship", shipToAddress: "Destination" };
  assert.equal(convertMessageSchema.safeParse(shipping).success, true);
  const missingDestination = convertMessageSchema.safeParse({ ...shipping, shipToAddress: "" });
  assert.equal(missingDestination.success, false);
  assert.ok(!missingDestination.success && missingDestination.error.issues.some((issue) => issue.path[0] === "shipToAddress"));
  assert.equal(convertMessageSchema.safeParse({ ...base, address: "x".repeat(301) }).success, false);
});

test("Sourcing quote requires profile fields but not Logistics details", () => {
  assert.deepEqual(missingQuoteFields({
    ...complete,
    customerKind: "SOURCING",
    phone: "",
    shippingMode: null,
    weightKg: null,
    logisticsClass: null,
    packageDimensions: null,
    shipToAddress: null,
    requirements: null,
  }), ["Số điện thoại"]);
});

test("FCL profile needs a container class but no per-package dimensions", () => {
  assert.deepEqual(missingQuoteFields({ ...complete, logisticsClass: "FCL", packageDimensions: null }), []);
  assert.deepEqual(missingQuoteFields({ ...complete, logisticsClass: null }), ["LCL/FCL"]);
});

test("khách Sourcing không bắt buộc Số lượng, khách Logistics vẫn bắt buộc", async () => {
  const { convertMessageSchema } = await import("@speego/shared");
  assert.deepEqual(missingQuoteFields({ ...complete, customerKind: "SOURCING", quantityNote: "" }), []);
  assert.ok(missingQuoteFields({ ...complete, quantityNote: "" }).includes("Số lượng"));
  const base = { phone: "0900000000", brand: "SOURCING", customerType: "INDIVIDUAL", careChannel: "ZALO", productInterest: "Ghế", address: "HN", saleNote: "Ghi chú", requirements: "Yêu cầu" };
  assert.equal(convertMessageSchema.safeParse(base).success, true);
  const shipping = convertMessageSchema.safeParse({ ...base, shippingMode: "AIR", weightKg: "10", shipToAddress: "HCM", packageDimensions: "10x10x10", reason: "Cần gửi" });
  assert.equal(shipping.success, false);
  assert.ok(!shipping.success && shipping.error.issues.some((issue) => issue.path[0] === "quantityNote" && issue.message === "Nhập số lượng"));
});
