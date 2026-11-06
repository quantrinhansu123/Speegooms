import type { PotentialRecord } from "./types";

type LogisticsQuoteFields = Pick<PotentialRecord,
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

const requiredLogisticsFields = [
  ["fullName", "Tên khách"],
  ["phone", "Số điện thoại"],
  ["brand", "Nguồn"],
  ["potential", "Giai đoạn"],
  ["customerType", "Đối tượng"],
  ["productInterest", "Hàng hóa"],
  ["quantityNote", "Số lượng"],
  ["address", "Địa chỉ"],
  ["saleNote", "Ghi chú sale"],
  ["careChannel", "Kênh chăm sóc"],
  ["weightKg", "Trọng lượng"],
  ["shipToAddress", "Địa chỉ nhận hàng"],
  ["requirements", "Yêu cầu của khách"],
  ["convertReason", "Lý do chuyển"],
] as const;

export function missingLogisticsQuoteFields(row: LogisticsQuoteFields): string[] {
  if (row.customerKind !== "LOGISTICS") return [];
  const missing: string[] = requiredLogisticsFields
    .filter(([field]) => !row[field]?.trim())
    .map(([, label]) => label);
  if (row.shippingMode === "SEA" && !row.logisticsClass) missing.push("LCL/FCL");
  if (row.logisticsClass !== "FCL" && !row.packageDimensions?.trim()) missing.push("Kích thước kiện hàng");
  return missing;
}
