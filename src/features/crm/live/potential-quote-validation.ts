import type { PotentialRecord } from "./types";

type QuoteFields = Pick<PotentialRecord,
  | "customerKind"
  | "fullName"
  | "companyName"
  | "phone"
  | "email"
  | "productInterest"
  | "quantityNote"
  | "address"
  | "saleNote"
  | "potential"
  | "customerType"
  | "brand"
  | "careChannel"
  | "classification"
  | "packageDimensions"
  | "weightKg"
  | "logisticsClass"
  | "shippingMode"
  | "shipToAddress"
  | "requirements"
  | "convertReason"
>;

const requiredQuoteFields = [
  ["fullName", "Tên khách"],
  ["phone", "Số điện thoại"],
  ["brand", "Nguồn"],
  ["potential", "Giai đoạn"],
  ["customerType", "Đối tượng"],
  ["productInterest", "Hàng hóa"],
  ["quantityNote", "Số lượng"],
  ["saleNote", "Ghi chú sale"],
  ["careChannel", "Kênh chăm sóc"],
] as const;

const requiredLogisticsFields = [
  ["shippingMode", "Phương thức vận chuyển"],
  ["weightKg", "Trọng lượng"],
  ["shipToAddress", "Địa chỉ nhận hàng"],
  ["requirements", "Yêu cầu của khách"],
  ["convertReason", "Lý do chuyển"],
] as const;

export function missingQuoteFields(row: QuoteFields): string[] {
  const requiredFields = row.customerKind === "LOGISTICS"
    ? [...requiredQuoteFields, ...requiredLogisticsFields]
    : requiredQuoteFields.filter(([field]) => field !== "quantityNote");
  const missing: string[] = requiredFields
    .filter(([field]) => !row[field]?.trim())
    .map(([, label]) => label);
  if (row.customerKind === "LOGISTICS" && row.shippingMode === "SEA" && !row.logisticsClass) missing.push("LCL/FCL");
  if (row.customerKind === "LOGISTICS" && row.logisticsClass !== "FCL" && !row.packageDimensions?.trim()) missing.push("Kích thước kiện hàng");
  return missing;
}
