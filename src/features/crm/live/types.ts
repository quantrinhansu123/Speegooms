export interface MessageRecord {
  id: string;
  messCode: string;
  source: string;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  goods: string | null;
  demand: string | null;
  customerType: string | null;
  note: string | null;
  receivedAt: string;
  leadId: string | null;
  leadCode: string | null;
}

export interface PotentialRecord {
  id: string;
  leadCode: string;
  messId: string | null;
  messCode: string | null;
  fullName: string | null;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  productInterest: string | null;
  quantityNote: string | null;
  address: string | null;
  saleNote: string | null;
  potential: string;
  status: string;
  customerKind: string | null;
  customerType: string | null;
  brand: string | null;
  careChannel: string | null;
  classification: string | null;
  packSpec: string | null;
  weightKg: number | null;
  logisticsClass: string | null;
  shipFromAddress: string | null;
  shipToAddress: string | null;
  createdAt: string;
}

export const brandOptions = [
  ["SPEEGO_NAIL", "SPEEGO NAIL", "bg-[#fde2e4] text-[#9f1239]"],
  ["SPEEGO_US", "SPEEGO US", "bg-[#fef3c7] text-[#92400e]"],
  ["SPEEGO_CA", "SPEEGO CA", "bg-[#dbeafe] text-[#1e3a8a]"],
  ["SPEEGO_AU", "SPEEGO ÚC", "bg-[#ede9fe] text-[#5b21b6]"],
  ["SPEEGO_BUSINESS", "SPEEGO BUSINESS", "bg-[#f3e8ff] text-[#6b21a8]"],
  ["SPEEGO_RETAIL", "SPEEGO RETAIL", "bg-[#dcfce7] text-[#166534]"],
  ["SOURCING", "SOURCING", "bg-[#e0f2fe] text-[#075985]"],
  ["LOGISTICS", "LOGISTICS", "bg-[#ffe4e6] text-[#be123c]"],
] as const;

export const demandOptions = [
  ["SHIPPING", "Vận chuyển"],
  ["SOURCING", "Tìm hàng"],
] as const;

export const customerTypeOptions = [
  ["INDIVIDUAL", "Cá nhân"],
  ["PRINCIPAL", "Chủ nhiệm"],
  ["ENTERPRISE", "Doanh nghiệp"],
] as const;

export const customerKindOptions = [
  ["SOURCING", "Thuần sourcing"],
  ["LOGISTICS", "Thuần logistics"],
  ["SOURCING_LOGISTICS", "Sourcing + Logistics"],
] as const;

export const classificationOptions = [
  ["LCL", "LCL"],
  ["FCL", "FCL"],
] as const;

export const potentialOptions = [
  ["POTENTIAL", "Tiềm năng"],
  ["CLOSING", "Đang chốt"],
  ["DEPOSITED", "Đã cọc"],
  ["NOT_ORDERED", "Không đặt"],
] as const;

export const messageStatusLabels: Record<string, string> = {
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  QUALIFIED: "Đủ điều kiện",
  CONVERTED: "Đã chuyển",
  LOST: "Mất",
  DORMANT: "Ngủ",
};

export function labelOf(options: readonly (readonly [string, string])[], value: string | null): string {
  return options.find((item) => item[0] === value)?.[1] ?? value ?? "—";
}
