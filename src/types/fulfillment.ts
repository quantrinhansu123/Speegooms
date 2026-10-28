import type { Camelize } from "./crm";

/** DTO Fulfillment (snake_case); model camelCase suy ra bằng Camelize. Xem types/crm.ts. */

export type ReceiptStatus = "cho-nhap" | "da-nhap" | "lech";
export type PackageStatus = "trong-kho" | "da-giu-cho" | "da-pick" | "da-dong-goi" | "da-xuat" | "da-giao";
export type OutboundStatus = "cho-pick" | "dang-pick" | "da-pick" | "da-dong-goi" | "da-xuat";
export type DeliveryStatus = "dang-giao" | "da-giao" | "giao-that-bai";
export type InquiryStatus = "moi" | "dang-xu-ly" | "da-tra-loi";

export interface WarehouseDto {
  warehouse_id: string;
  name: string;
  region: string;
}

/** Hàng về kho đích theo lô hàng; nhập kho khi kiểm đếm xong. */
export interface InboundReceiptDto {
  receipt_id: string;
  shipment_id: string;
  order_id: string;
  warehouse_id: string;
  arrived_on: string;
  status: ReceiptStatus;
  expected_qty: number;
  received_qty: number;
  received_at?: string;
  received_by?: string;
  note?: string;
}

export interface PackageDto {
  package_id: string;
  order_id: string;
  receipt_id: string;
  warehouse_id: string;
  sku: string;
  description: string;
  quantity: number;
  weight_kg: number;
  /** Vị trí lưu kho: khu-hàng-kệ, ví dụ A-03-12 */
  location: string;
  status: PackageStatus;
}

export interface OutboundDto {
  outbound_id: string;
  order_id: string;
  warehouse_id: string;
  package_ids: string[];
  picked_ids: string[];
  status: OutboundStatus;
  created_at: string;
  assignee_id: string;
  packed?: { weight_kg: number; boxes: number; packed_at: string; packed_by: string };
}

export interface DeliveryDto {
  delivery_id: string;
  outbound_id: string;
  order_id: string;
  carrier: string;
  recipient_name: string;
  address: string;
  /** Mã demo, không phải mã vận đơn thật */
  tracking_ref: string;
  status: DeliveryStatus;
  dispatched_at: string;
  delivered_at?: string;
  failure_reason?: string;
  /** Proof of delivery: chỉ ghi tên file minh chứng (demo), không lưu tệp */
  pod?: { received_by: string; signed_on: string; note: string; evidence_file: string };
}

export interface InquiryDto {
  inquiry_id: string;
  order_id: string;
  mess_id: string;
  asked_by: string;
  asked_at: string;
  question: string;
  priority: "cao" | "thuong";
  status: InquiryStatus;
  assignee_id?: string;
  answer?: string;
  answered_by?: string;
  answered_at?: string;
}

export interface FulfillmentSnapshotDto {
  warehouses: WarehouseDto[];
  receipts: InboundReceiptDto[];
  packages: PackageDto[];
  outbounds: OutboundDto[];
  deliveries: DeliveryDto[];
  inquiries: InquiryDto[];
}

export type Warehouse = Camelize<WarehouseDto>;
export type InboundReceipt = Camelize<InboundReceiptDto>;
export type Package = Camelize<PackageDto>;
export type Outbound = Camelize<OutboundDto>;
export type Delivery = Camelize<DeliveryDto>;
export type Inquiry = Camelize<InquiryDto>;
export type FulfillmentSnapshot = Camelize<FulfillmentSnapshotDto>;
