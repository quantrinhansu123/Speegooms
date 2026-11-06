import assert from "node:assert/strict";
import { test } from "node:test";
import { missingLogisticsQuoteFields } from "./potential-quote-validation.ts";

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
  assert.deepEqual(missingLogisticsQuoteFields(complete), []);
  assert.deepEqual(missingLogisticsQuoteFields({ ...complete, companyName: " ", weightKg: "  ", shipToAddress: null }), [
    "Trọng lượng",
    "Địa chỉ nhận hàng",
  ]);
});

test("Logistics quote accepts blank company and email", () => {
  for (const value of [null, "", "  "]) {
    assert.deepEqual(missingLogisticsQuoteFields({ ...complete, companyName: value, email: value }), []);
  }
});

test("Sourcing quote does not require Logistics details", () => {
  assert.deepEqual(missingLogisticsQuoteFields({
    ...complete,
    customerKind: "SOURCING",
    companyName: null,
    requirements: null,
  }), []);
});

test("FCL profile needs a container class but no per-package dimensions", () => {
  assert.deepEqual(missingLogisticsQuoteFields({ ...complete, logisticsClass: "FCL", packageDimensions: null }), []);
  assert.deepEqual(missingLogisticsQuoteFields({ ...complete, logisticsClass: null }), ["LCL/FCL"]);
});
