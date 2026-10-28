import type { Camelize, TransportMode } from "./crm";

/** DTO Vận hành (snake_case), model camelCase suy ra bằng Camelize. Xem types/crm.ts. */

export type SupplierCountry = "VN" | "CN";
export type SupplierStatus = "dang-hop-tac" | "theo-doi" | "tam-dung";
export type RequestStatus = "moi" | "dang-tim" | "co-bao-gia" | "da-chon" | "huy";
export type SupplierQuoteStatus = "cho-chon" | "da-chon" | "loai";
export type PoStatus = "nhap" | "da-gui" | "xac-nhan" | "dang-san-xuat" | "qc" | "san-sang" | "da-giao-vc" | "huy";
export type QcResult = "cho" | "dat" | "khong-dat" | "khong-ap-dung";
export type HandoverStatus = "cho-xac-nhan" | "da-nhan" | "tra-lai";
export type MilestoneKey = "receive" | "dispatch" | "international" | "customs" | "arrive" | "deliver";
export type ShipmentStatus = "chua-nhan" | "dang-xu-ly" | "dang-van-chuyen" | "thong-quan" | "da-den-kho" | "da-giao";
export type DocType = "invoice" | "packing-list" | "awb" | "bl" | "customs";
export type DocStatus = "thieu" | "cho-duyet" | "da-duyet" | "tu-choi";

export interface OpsStaffDto {
  id: string;
  name: string;
  team: "van-hanh";
  title: string;
}

export interface SupplierDto {
  supplier_id: string;
  name: string;
  country: SupplierCountry;
  city: string;
  categories: string[];
  rating: number;
  on_time_rate: number;
  lead_time_days: number;
  moq: string;
  contact_name: string;
  phone: string;
  status: SupplierStatus;
  note?: string;
}

export interface PartnerDto {
  partner_id: string;
  name: string;
  mode: "air" | "sea" | "both";
  coverage: string;
}

export interface SourcingRequestDto {
  request_id: string;
  rfq_id: string;
  mess_id: string;
  customer_id: string;
  route: "vn" | "global";
  status: RequestStatus;
  assignee_id: string;
  created_at: string;
  due_on: string;
  selected_quote_id?: string;
}

export interface SupplierQuoteDto {
  quote_id: string;
  request_id: string;
  supplier_id: string;
  quantity: number;
  goods_unit_price: number;
  freight_cost: number;
  handling_fee: number;
  lead_time_days: number;
  moq: string;
  valid_until: string;
  payment_terms: string;
  note?: string;
  status: SupplierQuoteStatus;
}

export interface PurchaseOrderDto {
  po_id: string;
  order_id: string;
  request_id: string;
  supplier_id: string;
  quote_id: string;
  status: PoStatus;
  amount: number;
  created_at: string;
  placed_at?: string;
  expected_ready_on: string;
  /** Khóa theo config/operations.ts (qcItems) */
  qc: Record<string, { result: QcResult; note?: string }>;
  assignee_id: string;
}

export interface OpsOrderDto {
  order_id: string;
  assignee_id: string;
  due_on: string;
  handover: {
    /** Khóa theo config/operations.ts (handoverItems) */
    items: Record<string, boolean>;
    status: HandoverStatus;
    note?: string;
    reviewed_at?: string;
    reviewed_by?: string;
  };
}

export interface CostSetDto {
  freight: number;
  customs: number;
  handling: number;
  other: number;
}

export interface ShipmentDto {
  shipment_id: string;
  order_id: string;
  mode: TransportMode;
  origin_point: string;
  destination: string;
  partner_id: string;
  etd: string;
  eta: string;
  milestones: Record<MilestoneKey, { planned_on: string; actual_on?: string }>;
  costs: { estimated: CostSetDto; actual?: CostSetDto };
  /** Mã demo, không phải mã vận đơn thật */
  tracking_ref: string;
  assignee_id: string;
}

export interface TrackingEventDto {
  id: string;
  shipment_id: string;
  at: string;
  location: string;
  text: string;
  /** demo: dữ liệu mẫu; manual: nhân viên nhập tay. Không có nguồn thời gian thực. */
  source: "demo" | "manual";
}

export interface OpsDocumentDto {
  doc_id: string;
  shipment_id: string;
  order_id: string;
  type: DocType;
  status: DocStatus;
  file_name?: string;
  updated_at: string;
  note?: string;
}

export interface OpsHistoryDto {
  id: string;
  /** Rỗng với thao tác chưa gắn đơn (ví dụ yêu cầu tìm nguồn) */
  order_id: string;
  /** Mã bản ghi liên quan (yêu cầu, PO, lô hàng) khi không có order_id */
  ref_id?: string;
  at: string;
  by: string;
  text: string;
}

export interface OpsSnapshotDto {
  staff: OpsStaffDto[];
  suppliers: SupplierDto[];
  partners: PartnerDto[];
  requests: SourcingRequestDto[];
  supplier_quotes: SupplierQuoteDto[];
  pos: PurchaseOrderDto[];
  orders: OpsOrderDto[];
  shipments: ShipmentDto[];
  tracking_events: TrackingEventDto[];
  documents: OpsDocumentDto[];
  history: OpsHistoryDto[];
}

export type OpsStaff = Camelize<OpsStaffDto>;
export type Supplier = Camelize<SupplierDto>;
export type Partner = Camelize<PartnerDto>;
export type SourcingRequest = Camelize<SourcingRequestDto>;
export type SupplierQuote = Camelize<SupplierQuoteDto>;
export type PurchaseOrder = Camelize<PurchaseOrderDto>;
export type OpsOrder = Camelize<OpsOrderDto>;
export type CostSet = Camelize<CostSetDto>;
export type Shipment = Camelize<ShipmentDto>;
export type TrackingEvent = Camelize<TrackingEventDto>;
export type OpsDocument = Camelize<OpsDocumentDto>;
export type OpsHistory = Camelize<OpsHistoryDto>;
export type OpsSnapshot = Camelize<OpsSnapshotDto>;
