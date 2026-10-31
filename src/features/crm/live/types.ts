import type { QuoteBank, QuoteDesk, QuoteNotes, QuoteOrder, SentQuote } from "@speego/shared";

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
  market: string | null;
  classification: string | null;
  saleName: string | null;
  painPoint: string | null;
  linkMess: string | null;
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
  linkMess: string | null;
  requirements: string | null;
  requirementImages: string[];
  convertReason: string | null;
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

export const messageClassificationOptions = [
  ["HOT", "Hot"],
  ["WARM", "Warm"],
  ["COLD", "Cold"],
  ["DEAD", "Dead"],
] as const;

export const customerTypeOptions = [
  ["INDIVIDUAL", "Cá nhân"],
  ["PRINCIPAL", "Chủ tiệm"],
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

export const careChannelOptions = [
  ["FACEBOOK", "FACEBOOK"],
  ["ZALO", "ZALO"],
  ["WHATSAPP", "WHATSAPP"],
  ["VIBER", "VIBER"],
] as const;

export interface RfqQuoteRecord extends QuoteRecord {
  desk: "sourcing" | "logistics";
}

export interface QuoteRecord {
  id: string;
  code: string;
  potentialId: string;
  leadCode: string;
  customerName: string | null;
  companyName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  customerKind: string | null;
  customerType: string | null;
  brand: string | null;
  potential: string | null;
  careChannel: string | null;
  classification: string | null;
  goods: string | null;
  quantityNote: string | null;
  saleNote: string | null;
  packSpec: string | null;
  weightKg: number | null;
  logisticsClass: string | null;
  shipFromAddress: string | null;
  shipToAddress: string | null;
  messCode: string | null;
  linkMess: string | null;
  templateId: string | null;
  templateName: string | null;
  opsNote: string | null;
  quoteStatus: string;
  contractStatus: string;
  orders: QuoteOrder[];
  notes: QuoteNotes;
  bank: QuoteBank;
  sentQuote: SentQuote | null;
  logisticsQuoteId: string | null;
  logisticsSheet: QuoteSheet | null;
  requirements: string | null;
  requirementImages: string[];
  createdAt: string;
}

export interface QuoteSheet {
  templateId: string | null;
  templateName: string | null;
  opsNote: string | null;
  quoteStatus: string;
  contractStatus: string;
  orders: QuoteOrder[];
  notes: QuoteNotes;
  bank: QuoteBank;
  sentQuote: SentQuote | null;
}

export interface QuoteTemplateRecord {
  id: string;
  name: string;
  content: string | null;
  createdAt: string;
}

export const quoteStatusOptions = [
  ["CHUA_CO_BAO_GIA", "Chưa có báo giá"],
  ["DA_CO_BAO_GIA", "Đã có báo giá"],
  ["CHUA_CO_BAO_GIA_LAI", "Chưa có báo giá lại"],
  ["DA_CO_BAO_GIA_LAI", "Đã có báo giá lại"],
] as const;

export const contractStatusOptions = [
  ["CHUA_TAO", "Chưa tạo"],
  ["DA_TAO", "Đã tạo"],
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

export const deskLabels: Record<QuoteDesk, string> = {
  sourcing: "Sourcing",
  logistics: "Logistics",
};

export function deskLabel(desk: QuoteDesk): string {
  return deskLabels[desk];
}
