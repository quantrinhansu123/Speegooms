/**
 * DTO: hình dạng dữ liệu "trên dây" (snake_case, khớp tên khóa trong tài liệu: mess_id, rfq_id, order_id, customer_id).
 * Model miền (camelCase) suy ra từ DTO bằng kiểu Camelize; chuyển đổi nằm ở services/crm/adapters.ts.
 * Khi có backend, chỉ cần đảm bảo API trả đúng các DTO này.
 */

export type Team = "sale-vn" | "sale-global";
export type RouteCode = "vn" | "global";
export type GoodsOrigin = "vn" | "cn" | "unknown";
export type LeadSource = "ads" | "google" | "organic" | "affiliate";
export type Temperature = "hot" | "warm" | "cold";
export type CareStatus = "moi" | "dang-cham" | "ngu-dong" | "da-co-rfq" | "mat";
export type LostReason = "gia" | "thoi-gian" | "niem-tin" | "hang-chua-san-sang" | "khac";
export type InteractionType = "call" | "message" | "note" | "system";
export type RfqStatus = "moi" | "cho-gia" | "da-co-gia" | "da-bao-gia" | "da-chot" | "da-huy";
export type PriceRequestState = "chua-gui" | "cho-gia" | "da-co-gia";
export type TransportMode = "air" | "sea-lcl" | "sea-fcl";
export type QuoteStatus = "nhap" | "cho-duyet" | "da-gui" | "chap-nhan" | "tu-choi";
export type ApprovalState = "khong-can" | "cho-duyet" | "da-duyet" | "bi-tu-choi";
export type ContractStatus = "soan-thao" | "da-ky" | "huy";
export type DepositStatus = "chua-yeu-cau" | "cho-ke-toan" | "da-coc" | "khong-khop";
export type DepositChannel = "tai-khoan-cong-ty" | "khac";

export interface StaffDto {
  id: string;
  name: string;
  team: Team | "van-hanh" | "ke-toan";
  title: string;
}

export interface CustomerDto {
  customer_id: string;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  country: string;
  route: RouteCode;
  type: "doanh-nghiep" | "ca-nhan";
  created_at: string;
  owner_id: string;
  note?: string;
}

export interface ProfileEntryDto {
  value?: string;
  missing?: boolean;
  recontact_on?: string;
}

export interface NextTaskDto {
  title: string;
  due_on: string;
  done: boolean;
}

export interface LeadDto {
  mess_id: string;
  customer_id: string;
  contact_name: string;
  company: string;
  phone: string;
  email: string;
  created_at: string;
  source: LeadSource;
  goods_origin: GoodsOrigin;
  temperature: Temperature;
  care_status: CareStatus;
  lost_reason?: LostReason;
  lost_note?: string;
  owner_id: string;
  need_summary: string;
  /** Khóa theo cấu hình config/crm.ts (leadProfileFields) */
  profile: Record<string, ProfileEntryDto>;
  next_task?: NextTaskDto;
}

export interface InteractionDto {
  id: string;
  mess_id: string;
  type: InteractionType;
  content: string;
  at: string;
  by: string;
}

export interface PriceRequestDto {
  sourcing: PriceRequestState;
  logistics: PriceRequestState;
  sent_at?: string;
}

export interface RfqDto {
  rfq_id: string;
  mess_id: string;
  customer_id: string;
  created_at: string;
  route: RouteCode;
  goods_origin: GoodsOrigin;
  status: RfqStatus;
  goods_name: string;
  quantity: number;
  unit: string;
  origin_point: string;
  destination: string;
  transport_mode: TransportMode;
  target_date: string;
  special_requirements: string;
  sensitive_goods: boolean;
  price_request: PriceRequestDto;
  owner_id: string;
}

export interface QuoteLineDto {
  id: string;
  label: string;
  quantity: number;
  unit_price: number;
  /** Giá vốn nội bộ, không hiển thị cho khách */
  cost_price?: number;
}

export interface QuotationDto {
  quote_id: string;
  rfq_id: string;
  mess_id: string;
  customer_id: string;
  version: number;
  status: QuoteStatus;
  currency: "VND" | "USD";
  created_at: string;
  sent_at?: string;
  valid_until: string;
  goods: QuoteLineDto[];
  freight: QuoteLineDto[];
  surcharges: QuoteLineDto[];
  discount_percent: number;
  approval: { state: ApprovalState; note?: string };
  response_note?: string;
  terms_note: string;
  owner_id: string;
}

export interface DepositDto {
  status: DepositStatus;
  amount: number;
  requested_at?: string;
  requested_by?: string;
  channel?: DepositChannel;
  bill_ref?: string;
  note?: string;
  confirmed_at?: string;
  confirmed_by?: string;
  mismatch_note?: string;
}

export interface ContractDto {
  order_id: string;
  contract_no: string;
  rfq_id: string;
  mess_id: string;
  customer_id: string;
  quote_id: string;
  route: RouteCode;
  value: number;
  currency: "VND" | "USD";
  status: ContractStatus;
  created_at: string;
  signed_at?: string;
  /** Mô phỏng ngưỡng B: hợp đồng giá trị lớn cần Ban GĐ duyệt */
  board_approval: ApprovalState;
  deposit: DepositDto;
  handover: { status: "chua" | "da-ban-giao"; at?: string };
  owner_id: string;
}

export interface CrmSnapshotDto {
  staff: StaffDto[];
  customers: CustomerDto[];
  leads: LeadDto[];
  interactions: InteractionDto[];
  rfqs: RfqDto[];
  quotations: QuotationDto[];
  contracts: ContractDto[];
}

type CamelCase<S extends string> = S extends `${infer H}_${infer T}` ? `${H}${Capitalize<CamelCase<T>>}` : S;
export type Camelize<T> = T extends readonly (infer U)[]
  ? Camelize<U>[]
  : T extends object
    ? { [K in keyof T as CamelCase<K & string>]: Camelize<T[K]> }
    : T;

export type Staff = Camelize<StaffDto>;
export type Customer = Camelize<CustomerDto>;
export type Lead = Camelize<LeadDto>;
export type Interaction = Camelize<InteractionDto>;
export type Rfq = Camelize<RfqDto>;
export type QuoteLine = Camelize<QuoteLineDto>;
export type Quotation = Camelize<QuotationDto>;
export type Contract = Camelize<ContractDto>;
export type CrmSnapshot = Camelize<CrmSnapshotDto>;
