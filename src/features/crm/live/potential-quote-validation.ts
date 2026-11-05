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
  | "shipToAddress"
  | "requirements"
  | "convertReason"
>;

const requiredLogisticsFields = [
  ["fullName", "Tên khách"],
  ["companyName", "Công ty"],
  ["phone", "Số điện thoại"],
  ["email", "Email"],
  ["brand", "Nguồn"],
  ["potential", "Giai đoạn"],
  ["customerType", "Đối tượng"],
  ["productInterest", "Hàng hóa"],
  ["quantityNote", "Số lượng"],
  ["address", "Địa chỉ"],
  ["saleNote", "Ghi chú sale"],
  ["careChannel", "Kênh chăm sóc"],
  ["classification", "Phân loại"],
  ["packageDimensions", "Kích thước kiện hàng"],
  ["weightKg", "Trọng lượng"],
  ["logisticsClass", "Phân loại logistics"],
  ["shipToAddress", "Địa chỉ nhận hàng"],
  ["requirements", "Yêu cầu của khách"],
  ["convertReason", "Lý do chuyển"],
] as const;

export function missingLogisticsQuoteFields(row: LogisticsQuoteFields): string[] {
  if (row.customerKind !== "LOGISTICS") return [];
  return requiredLogisticsFields
    .filter(([field]) => !row[field]?.trim())
    .map(([, label]) => label);
}
