import {
  isCombinedSourcing,
  quoteVndRates,
  fclQuoteSchema,
  quotePaymentSchema,
  paymentsInMain,
  productAmounts,
  shippingAmount,
  shippingInCurrency,
  sumByCurrency,
  totalsInMain,
  logisticsOrderFromSourcing,
  orderHasContent,
  quoteOrderSchema,
  sourcingHandoffOrder,
  quoteAccessKind,
  type QuoteWorkflow,
  type AccountingContractInput,
  type CreateContractInput,
  type ConvertMessageInput,
  type CreateMessageInput,
  type CrmLane,
  type IndustryCategory,
  type OpsContractInput,
  defaultQuoteBank,
  type QuoteBank,
  type QuoteDesk,
  type QuoteCurrency,
  type QuoteLine,
  type QuoteNotes,
  type QuoteOrder,
  shippingNoteKeys,
  type ShippingNoteKey,
  type SaleContractPaymentInput,
  type SentQuote,
  type QuoteTemplateInput,
  type UpdateMessageInput,
  type UpdatePotentialInput,
  type UpdateQuoteInput,
  type UpdateQuoteOutcomeInput,
} from "@speego/shared";
import type pg from "pg";
import { AppError, InfrastructureError } from "../../lib/errors";
import { COMBINED_HANDED_OFF_SQL, isLogisticsHandedOff, LOGISTICS_SHEET_UNSEEDED_SQL, mergeHandoffSql } from "./logistics-handoff";
import type {
  ContractListSearch,
  MessageListSearch,
  PotentialListSearch,
  QuoteListSearch,
} from "../../search/crm-list-search";
import { contractSearch, messageSearch, potentialSearch, quoteSearch } from "../../search/crm-list-search";
import { sql } from "../../search/sql-expression";
import type {
  ContractRecord,
  ContractView,
  CrmRepository,
  MessageRecord,
  PotentialRecord,
  QuoteRecord,
  QuoteSheet,
  QuoteTemplateRecord,
  ReassignQuoteResult,
  RfqQuoteRecord,
} from "../../repositories/crm.repository";

type MessageRow = {
  id: string;
  mess_code: string;
  source: string;
  customer_name_raw: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  goods: string | null;
  industry: IndustryCategory | null;
  demand: string | null;
  customer_type: string | null;
  note: string | null;
  market: string | null;
  classification: string | null;
  sale_name: string | null;
  pain_point: string | null;
  link_mess: string | null;
  brand: string | null;
  order_info: unknown;
  received_at: Date | string;
  lead_id: string | null;
  lead_code: string | null;
};

type PotentialRow = {
  id: string;
  lead_code: string;
  mess_id: string | null;
  mess_code: string | null;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  product_interest: string | null;
  industry: IndustryCategory | null;
  quantity_note: string | null;
  address: string | null;
  sale_note: string | null;
  potential: string;
  status: string;
  customer_kind: string | null;
  quote_workflow: QuoteWorkflow;
  customer_type: string | null;
  brand: string | null;
  care_channel: string | null;
  classification: string | null;
  pack_spec: string | null;
  package_dimensions: string | null;
  weight_kg: string | null;
  order_lines: unknown;
  order_info: unknown;
  logistics_class: string | null;
  shipping_mode: "AIR" | "SEA" | null;
  ship_from_address: string | null;
  ship_to_address: string | null;
  link_mess: string | null;
  requirements: string | null;
  requirement_images: unknown;
  convert_reason: string | null;
  created_at: Date | string;
};

const laneTables = {
  vn: { message: "crm.tin_nhan_viet_nam", potential: "crm.khach_hang_tiem_nang_viet_nam" },
  global: { message: "crm.tin_nhan_global", potential: "crm.khach_hang_tiem_nang_global" },
} as const;

const quoteTables = {
  vn: {
    message: "crm.tin_nhan_viet_nam",
    potential: "crm.khach_hang_tiem_nang_viet_nam",
    sourcing: "crm.bao_gia_sourcing_viet_nam",
    logistics: "crm.bao_gia_logistics_viet_nam",
  },
  global: {
    message: "crm.tin_nhan_global",
    potential: "crm.khach_hang_tiem_nang_global",
    sourcing: "crm.bao_gia_sourcing_global",
    logistics: "crm.bao_gia_logistics_global",
  },
} as const;

type QuoteRow = {
  id: string;
  code: string;
  potential_id: string;
  lead_code: string;
  customer_name: string | null;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  customer_kind: string | null;
  quote_workflow: QuoteWorkflow;
  customer_type: string | null;
  brand: string | null;
  potential: string | null;
  care_channel: string | null;
  classification: string | null;
  goods: string | null;
  industry: IndustryCategory | null;
  non_close_reason: string | null;
  quantity_note: string | null;
  sale_note: string | null;
  pack_spec: string | null;
  package_dimensions: string | null;
  weight_kg: string | null;
  logistics_class: string | null;
  shipping_mode: "AIR" | "SEA" | null;
  ship_from_address: string | null;
  ship_to_address: string | null;
  mess_code: string | null;
  link_mess: string | null;
  template_id: string | null;
  template_name: string | null;
  ops_note: string | null;
  quote_status: string;
  contract_status: string;
  order_lines: unknown;
  common_notes: unknown;
  bank_account: unknown;
  sent_copy: unknown;
  logistics_quote_id: string | null;
  logistics_sheet: unknown;
  logistics_template_name: string | null;
  requirements: string | null;
  requirement_images: unknown;
  created_at: Date | string;
};

type TemplateRow = {
  id: string;
  name: string;
  content: string | null;
  created_at: Date | string;
};

function banOf(desk: QuoteDesk): "SOURCING" | "LOGISTICS" {
  return desk === "sourcing" ? "SOURCING" : "LOGISTICS";
}

function desksForKind(kind: string | null): QuoteDesk[] {
  if (kind === "SOURCING") return ["sourcing"];
  if (kind === "LOGISTICS") return ["logistics"];
  if (kind === "SOURCING_LOGISTICS") return ["sourcing", "logistics"];
  return [];
}

function kindClause(
  allowedKinds: readonly string[] | null,
  startAt: number,
): { sql: string; values: unknown[] } {
  if (!allowedKinds) return { sql: "", values: [] };
  return {
    sql: ` and (case when l.nhom_khach::text = 'SOURCING' and l.luong_bao_gia = 'COMBINED' then 'SOURCING_LOGISTICS' else l.nhom_khach::text end) = any($${startAt}::text[])`,
    values: [allowedKinds],
  };
}

function quoteSelect(
  quote: string,
  potential: string,
  message: string,
  logistics: string | null,
  sheet: boolean,
): string {
  const logisticsColumn = logistics ? "lq.id::text" : "null";
  const logisticsJoin = logistics
    ? `left join ${logistics} lq on lq.ma_khach_hang_tiem_nang = q.ma_khach_hang_tiem_nang`
    : "";
  const sheetColumns = sheet
    ? "q.bao_gia_logistics as logistics_sheet, lm.ten as logistics_template_name"
    : "null::jsonb as logistics_sheet, null::text as logistics_template_name";
  const sheetJoin = sheet
    ? "left join crm.mau_bao_gia lm on lm.id = nullif(q.bao_gia_logistics->>'templateId', '')::uuid"
    : "";
  return `
  select q.id::text as id, q.ma_hien_thi as code,
         q.ma_khach_hang_tiem_nang::text as potential_id, l.ma_tiem_nang as lead_code,
         l.ho_ten as customer_name, l.ten_cong_ty as company_name, l.dia_chi as address,
         l.so_dien_thoai as phone, l.thu_dien_tu as email, l.nhom_khach::text as customer_kind, l.luong_bao_gia as quote_workflow,
         l.loai_khach_hang::text as customer_type, l.thuong_hieu::text as brand,
         l.tiem_nang::text as potential, l.kenh_cham_soc as care_channel,
         l.phan_loai::text as classification,
         l.san_pham_quan_tam as goods, msg.nganh_hang as industry, l.ghi_chu_so_luong as quantity_note,
         l.ghi_chu_ban_hang as sale_note, l.quy_cach_dong_goi as pack_spec,
         l.kich_thuoc_kien_hang as package_dimensions,
         l.trong_luong_kg as weight_kg, l.phan_loai_logistics as logistics_class,
         l.phuong_thuc_van_chuyen as shipping_mode,
         l.dia_chi_gui as ship_from_address, l.dia_chi_nhan as ship_to_address,
         l.yeu_cau_khach as requirements, l.anh_yeu_cau as requirement_images,
         msg.ma_hien_thi as mess_code, msg.link_mess as link_mess,
         q.ma_mau::text as template_id, m.ten as template_name,
         q.ghi_chu_vh as ops_note, q.trang_thai_bao_gia::text as quote_status,
         q.trang_thai_hop_dong::text as contract_status, q.ly_do_khong_chot as non_close_reason,
         q.chi_tiet_don_hang as order_lines, q.ghi_chu as common_notes,
         q.tai_khoan_ngan_hang as bank_account, q.ban_da_gui as sent_copy,
         ${logisticsColumn} as logistics_quote_id, ${sheetColumns}, q.tao_luc as created_at
  from ${quote} q
  join ${potential} l on l.id = q.ma_khach_hang_tiem_nang
  left join crm.mau_bao_gia m on m.id = q.ma_mau
  left join ${message} msg on msg.id = l.ma_tin_nhan
  ${sheetJoin}
  ${logisticsJoin}
  where l.xoa_luc is null
`;
}

function emptyLogisticsSheet() {
  return {
    templateId: null,
    opsNote: "",
    quoteStatus: "CHUA_CO_BAO_GIA",
    contractStatus: "CHUA_TAO",
    orders: [],
    notes: { totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "", deposit: [], logisticsFees: [], opsExtra: "", freight: { rate: null, total: null, totalManual: false } },
    bank: defaultQuoteBank,
    sentQuote: null,
  };
}

/** Phiếu Logistics tạo khi Sourcing chuyển sang. Dấu handoffAt cho biết đã chuyển, kể cả khi chưa có đơn hàng. */
function handoffSheetOf(orders: QuoteOrder[]) {
  return { ...emptyLogisticsSheet(), handoffAt: new Date().toISOString(), orders };
}

function optionalAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asCurrency(value: unknown): QuoteCurrency {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(code) ? code : "VND";
}

function textField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const legacyOrderId = "00000000-0000-4000-8000-000000000001";

function asOrders(value: unknown): QuoteOrder[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const first = value.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  if (first && Array.isArray(first.lines)) {
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const id = textField(row.id);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return [];
      return [{
        id,
        name: textField(row.name) || "Mẫu đơn hàng",
        selected: row.selected === true,
        currency: asCurrency(row.currency),
        rate: typeof row.rate === "number" && row.rate > 0 ? row.rate : null,
        priceColumns: asPriceColumns(row.priceColumns),
        lines: asLines(row.lines),
      }];
    });
  }
  const lines = asLines(value);
  if (lines.length === 0) return [];
  return [{ id: legacyOrderId, name: "Mẫu 1", selected: true, currency: "VND", rate: null, priceColumns: [], lines }];
}

function asPriceColumns(value: unknown): QuoteOrder["priceColumns"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const currency = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : "";
    if (!/^[A-Z]{3}$/.test(currency)) return [];
    return [{ currency, rate: typeof row.rate === "number" && row.rate > 0 ? row.rate : null }];
  }).slice(0, 8);
}

function asLinePrices(value: unknown): QuoteLine["prices"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const currency = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : "";
    if (!/^[A-Z]{3}$/.test(currency)) return [];
    return [{ currency, pricePerSet: optionalAmount(row.pricePerSet), lineTotal: optionalAmount(row.lineTotal), lineTotalManual: row.lineTotalManual === true }];
  }).slice(0, 8);
}

function asLines(value: unknown): QuoteLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const images = asImages(row.images, row.image);
    return [{
      stt: textField(row.stt),
      productName: textField(row.productName),
      image: images[0] ?? "",
      images,
      quantity: optionalAmount(row.quantity),
      pricePerSet: optionalAmount(row.pricePerSet),
      lineTotal: optionalAmount(row.lineTotal),
      lineTotalManual: row.lineTotalManual === true,
      weightKg: optionalAmount(row.weightKg),
      spec: textField(row.spec),
      note: textField(row.note),
      specEn: textField(row.specEn),
      noteEn: textField(row.noteEn),
      unit: textField(row.unit) || "cái",
      basis: asBasis(row.basis),
      cbm: optionalAmount(row.cbm),
      areaM2: optionalAmount(row.areaM2),
      packages: asPackages(row.packages),
      attrs: asAttrs(row.attrs),
      prices: asLinePrices(row.prices),
    }];
  });
}

function asImages(value: unknown, legacy: unknown): string[] {
  const fromArray = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
  if (fromArray.length > 0) return fromArray.slice(0, 8);
  const single = typeof legacy === "string" ? legacy.trim() : "";
  return single ? [single] : [];
}

function asBasis(value: unknown): QuoteLine["basis"] {
  return value === "kg" || value === "m2" || value === "cbm" || value === "lump" ? value : "unit";
}

function asPackages(value: unknown): QuoteLine["packages"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const count = optionalAmount(row.count);
    if (count == null || count < 1) return [];
    return [{
      count: Math.floor(count),
      lengthCm: optionalAmount(row.lengthCm) ?? 0,
      widthCm: optionalAmount(row.widthCm) ?? 0,
      heightCm: optionalAmount(row.heightCm) ?? 0,
      actualKg: optionalAmount(row.actualKg) ?? 0,
    }];
  });
}

function asAttrs(value: unknown): QuoteLine["attrs"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [{ key: textField(row.key), value: textField(row.value), keyEn: textField(row.keyEn), valueEn: textField(row.valueEn) }];
  });
}

function asDeposit(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => (typeof item === "string" ? [item] : []));
  const line = textField(value);
  return line ? [line] : [];
}

function asLogisticsFees(value: unknown): QuoteNotes["logisticsFees"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { label?: unknown; labelEn?: unknown; value?: unknown; currency?: unknown; itemStt?: unknown };
      const label = textField(row.label);
      if (!label) return null;
      const currency = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : "";
      return {
        label,
        labelEn: textField(row.labelEn),
        value: textField(row.value),
        currency: /^[A-Z]{3}$/.test(currency) ? currency : "",
        itemStt: textField(row.itemStt),
      };
    })
    .filter((item): item is QuoteNotes["logisticsFees"][number] => item != null)
    .slice(0, 30);
}

function asFreight(value: unknown): QuoteNotes["freight"] {
  const row = value && typeof value === "object" ? value as { rate?: unknown; cbmRate?: unknown; basis?: unknown; currency?: unknown; total?: unknown; totalManual?: unknown } : {};
  return {
    rate: optionalAmount(row.rate),
    cbmRate: optionalAmount(row.cbmRate),
    basis: row.basis === "cbm" || row.basis === "both" || row.basis === "lump" ? row.basis : "kg",
    currency: typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency.toUpperCase()) ? row.currency.toUpperCase() : "",
    total: optionalAmount(row.total),
    totalManual: row.totalManual === true,
  };
}

/** Lưu ý dưới Chi phí vận chuyển: giữ đúng các key hợp lệ; chưa từng lưu thì bỏ trống để bản in dùng mặc định cũ. */
function shippingNotesFrom(keys: unknown, other: unknown): Pick<QuoteNotes, "shippingNotes" | "shippingNoteOther"> {
  const valid = new Set<string>(shippingNoteKeys);
  return {
    ...(Array.isArray(keys) ? { shippingNotes: keys.filter((key): key is ShippingNoteKey => typeof key === "string" && valid.has(key)) } : {}),
    ...(typeof other === "string" ? { shippingNoteOther: other } : {}),
  };
}

function asNotes(value: unknown): QuoteNotes {
  const row = value && typeof value === "object"
    ? value as { totalLabel?: unknown; shippingLabel?: unknown; weightNote?: unknown; validityNote?: unknown; validityDays?: unknown; weightNoteEn?: unknown; validityNoteEn?: unknown; deposit?: unknown; depositEn?: unknown; logisticsFees?: unknown; opsExtra?: unknown; freight?: unknown; fcl?: unknown; payment?: unknown; shippingNotes?: unknown; shippingNoteOther?: unknown }
    : {};
  const deposit = asDeposit(row.deposit);
  return {
    totalLabel: textField(row.totalLabel),
    shippingLabel: textField(row.shippingLabel),
    weightNote: textField(row.weightNote),
    validityNote: textField(row.validityNote),
    validityDays: typeof row.validityDays === "number" && Number.isInteger(row.validityDays) && row.validityDays >= 1 ? row.validityDays : null,
    ...shippingNotesFrom(row.shippingNotes, row.shippingNoteOther),
    weightNoteEn: textField(row.weightNoteEn),
    validityNoteEn: textField(row.validityNoteEn),
    deposit,
    depositEn: asDeposit(row.depositEn).slice(0, deposit.length),
    logisticsFees: asLogisticsFees(row.logisticsFees),
    opsExtra: textField(row.opsExtra),
    freight: asFreight(row.freight),
    fcl: row.fcl ? fclQuoteSchema.parse(row.fcl) : undefined,
    payment: row.payment ? quotePaymentSchema.parse(row.payment) : undefined,
  };
}

function asBank(value: unknown): QuoteBank {
  const row = value && typeof value === "object" ? value as Partial<QuoteBank> : {};
  if (row.custom) return { custom: true, title: textField(row.title), bankName: textField(row.bankName), accountName: textField(row.accountName), accountNumber: textField(row.accountNumber), routingNumber: textField(row.routingNumber), swiftCode: textField(row.swiftCode) };
  return {
    title: textField(row.title) || defaultQuoteBank.title,
    accountName: textField(row.accountName) || defaultQuoteBank.accountName,
    accountNumber: textField(row.accountNumber) || defaultQuoteBank.accountNumber,
    routingNumber: textField(row.routingNumber) || defaultQuoteBank.routingNumber,
  };
}

function asSheet(value: unknown, templateName: string | null): QuoteSheet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const templateId = textField(row.templateId);
  return {
    templateId: templateId || null,
    templateName,
    opsNote: textField(row.opsNote) || null,
    quoteStatus: textField(row.quoteStatus) || "CHUA_CO_BAO_GIA",
    contractStatus: textField(row.contractStatus) || "CHUA_TAO",
    orders: asOrders(row.orders),
    notes: asNotes(row.notes),
    bank: asBank(row.bank),
    sentQuote: asSent(row.sentQuote),
  };
}

function asSent(value: unknown): SentQuote | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const order = asOrders([row.order])[0];
  if (!order || typeof row.sentAt !== "string") return null;
  return {
    sentAt: row.sentAt,
    order,
    notes: asNotes(row.notes),
    bank: asBank(row.bank),
  };
}

function toQuote(row: QuoteRow): QuoteRecord {
  return {
    id: row.id,
    code: row.code,
    potentialId: row.potential_id,
    leadCode: row.lead_code,
    customerName: row.customer_name,
    companyName: row.company_name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    customerKind: row.customer_kind,
    quoteWorkflow: row.quote_workflow,
    customerType: row.customer_type,
    brand: row.brand,
    potential: row.potential,
    careChannel: row.care_channel,
    classification: row.classification,
    goods: row.goods,
    industry: row.industry,
    nonCloseReason: row.non_close_reason,
    quantityNote: row.quantity_note,
    saleNote: row.sale_note,
    packSpec: row.pack_spec,
    packageDimensions: row.package_dimensions,
    weightKg: row.weight_kg,
    logisticsClass: row.logistics_class,
    shippingMode: row.shipping_mode,
    shipFromAddress: row.ship_from_address,
    shipToAddress: row.ship_to_address,
    messCode: row.mess_code,
    linkMess: row.link_mess,
    templateId: row.template_id,
    templateName: row.template_name,
    opsNote: row.ops_note,
    quoteStatus: row.quote_status,
    contractStatus: row.contract_status,
    orders: asOrders(row.order_lines),
    notes: asNotes(row.common_notes),
    bank: asBank(row.bank_account),
    sentQuote: asSent(row.sent_copy),
    logisticsQuoteId: row.logistics_quote_id,
    logisticsSheet: isLogisticsHandedOff(row.logistics_sheet, row.sent_copy)
      ? asSheet(row.logistics_sheet, row.logistics_template_name)
      : null,
    sourcingContext: null,
    requirements: row.requirements,
    requirementImages: imageList(row.requirement_images),
    createdAt: stamp(row.created_at),
  };
}

function toLogisticsQuote(row: QuoteRow): QuoteRecord {
  const base = toQuote(row);
  const sheet = base.logisticsSheet ?? {
    templateId: null,
    templateName: null,
    opsNote: null,
    quoteStatus: "CHUA_CO_BAO_GIA",
    contractStatus: "CHUA_TAO",
    orders: [],
    notes: asNotes(null),
    bank: asBank(null),
    sentQuote: null,
  };
  /** Thông tin đơn hàng Sourcing để Logistics luôn thấy dữ liệu đơn hàng, kể cả khi phiếu mới chuyển còn trống. */
  const handoffOrder = base.orders.find((order) => order.selected) ?? sourcingHandoffOrder(base);
  return {
    ...base,
    templateId: sheet.templateId,
    templateName: sheet.templateName,
    opsNote: sheet.opsNote,
    quoteStatus: sheet.quoteStatus,
    contractStatus: sheet.contractStatus,
    orders: sheet.orders.length === 0 && !sheet.sentQuote && handoffOrder
      ? [logisticsOrderFromSourcing(handoffOrder)]
      : sheet.orders.map((order) => order.id === handoffOrder?.id ? {
        ...order,
        lines: order.lines.map((line, index) => {
          const source = handoffOrder.lines[index];
          return source?.stt === line.stt ? { ...line, packages: source.packages, weightKg: source.weightKg, cbm: source.cbm } : line;
        }),
      } : order),
    notes: sheet.notes,
    bank: sheet.bank,
    sentQuote: sheet.sentQuote,
    logisticsSheet: null,
    sourcingContext: handoffOrder ? { order: handoffOrder, opsNote: base.opsNote } : null,
  };
}

function logisticsPayload(input: UpdateQuoteInput, status: string, sent: SentQuote | null) {
  return {
    templateId: input.templateId,
    opsNote: input.opsNote.trim(),
    quoteStatus: status,
    contractStatus: input.contractStatus,
    orders: input.orders,
    notes: input.notes,
    bank: input.bank,
    sentQuote: sent,
  };
}

function toTemplate(row: TemplateRow): QuoteTemplateRecord {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: stamp(row.created_at),
  };
}

function messageSelect(message: string, potential: string): string {
  return `
  select m.id::text as id, m.ma_hien_thi as mess_code, m.nguon::text as source,
         m.ten_khach_hang_tho as customer_name_raw, m.so_dien_thoai as phone, m.thu_dien_tu as email,
         m.trang_thai::text as status, m.hang_hoa as goods, m.nganh_hang as industry, m.nhu_cau::text as demand,
         m.loai_khach_hang::text as customer_type, m.ghi_chu as note,
         m.thi_truong as market, m.phan_loai::text as classification,
         m.nhan_vien_ban as sale_name, m.ghi_chu_van_de as pain_point, m.link_mess as link_mess,
         m.thong_tin_don_hang as order_info, m.thuong_hieu::text as brand,
         m.nhan_luc as received_at,
         l.id::text as lead_id, l.ma_tiem_nang as lead_code
  from ${message} m
  left join ${potential} l on l.ma_tin_nhan = m.id and l.xoa_luc is null
`;
}

function potentialSelect(lane: CrmLane): string {
  const { message, potential, sourcing, logistics } = quoteTables[lane];
  return `
  select l.id::text as id, l.ma_tiem_nang as lead_code,
         l.ma_tin_nhan::text as mess_id, m.ma_hien_thi as mess_code,
         l.ho_ten as full_name, l.ten_cong_ty as company_name,
         l.so_dien_thoai as phone, l.thu_dien_tu as email, l.nguon::text as source,
         coalesce(nullif(l.san_pham_quan_tam, ''), m.hang_hoa) as product_interest,
         m.nganh_hang as industry,
         l.ghi_chu_so_luong as quantity_note,
         l.dia_chi as address,
         coalesce(nullif(l.ghi_chu_ban_hang, ''), m.ghi_chu) as sale_note,
         l.tiem_nang::text as potential, l.trang_thai::text as status,
         l.nhom_khach::text as customer_kind, l.luong_bao_gia as quote_workflow, l.loai_khach_hang::text as customer_type,
         l.thuong_hieu::text as brand, l.kenh_cham_soc as care_channel,
         l.phan_loai::text as classification, l.quy_cach_dong_goi as pack_spec,
         l.kich_thuoc_kien_hang as package_dimensions,
         l.trong_luong_kg as weight_kg, l.phan_loai_logistics as logistics_class,
         case when l.nhom_khach = 'LOGISTICS' then lq.chi_tiet_don_hang else sq.chi_tiet_don_hang end as order_lines,
         m.thong_tin_don_hang as order_info,
         l.phuong_thuc_van_chuyen as shipping_mode,
         l.dia_chi_gui as ship_from_address, l.dia_chi_nhan as ship_to_address,
         m.link_mess as link_mess,
         l.yeu_cau_khach as requirements,
         l.anh_yeu_cau as requirement_images,
         l.ly_do_chuyen as convert_reason,
         l.tao_luc as created_at
  from ${potential} l
  left join ${message} m on m.id = l.ma_tin_nhan
  left join ${sourcing} sq on sq.ma_khach_hang_tiem_nang = l.id and l.nhom_khach = 'SOURCING'
  left join ${logistics} lq on lq.ma_khach_hang_tiem_nang = l.id and l.nhom_khach = 'LOGISTICS'
  where l.xoa_luc is null and l.tiem_nang is not null
`;
}

function blank(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

function receivedAt(value: string | undefined): string | null {
  return value ? `${value}T00:00:00+07:00` : null;
}

function weight(value: string | number | null): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dayText(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function moneyValue(value: string | number | null): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyParts(value: unknown): { currency: string; amount: number; converted?: number }[] | null {
  if (!Array.isArray(value)) return null;
  const parts = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as { currency?: unknown; amount?: unknown; converted?: unknown };
    if (typeof row.amount !== "number" && typeof row.amount !== "string") return [];
    const converted = typeof row.converted === "number" ? { converted: row.converted } : {};
    return [{ currency: asCurrency(row.currency), amount: moneyValue(row.amount), ...converted }];
  });
  return parts.length > 0 ? parts : null;
}

/** Cước logistics quy ra loại tiền chính của hợp đồng theo tỷ giá trên báo giá. Null khi thiếu tỷ giá. */
function convertedShipping(source: QuoteRecord | null, currency: string): number | null {
  if (!source) return null;
  const order = source.sentQuote?.order ?? source.orders.find((item) => item.selected) ?? source.orders[0];
  const sheet = source.customerKind === "LOGISTICS" ? source : source.logisticsSheet && { ...source.logisticsSheet, shippingMode: source.shippingMode, logisticsClass: source.logisticsClass };
  return sheet ? shippingInCurrency(sheet, { currency, rate: order?.rate ?? null }) : null;
}

/** Khoản đã lưu theo loại tiền. Hợp đồng cũ chỉ có một loại tiền cho cả sản phẩm và cước. */
function amountsFromRow(row: ContractRow): ContractRecord["amounts"] {
  const body = row.amounts_body && typeof row.amounts_body === "object" && !Array.isArray(row.amounts_body)
    ? row.amounts_body as { product?: unknown; shipping?: unknown }
    : null;
  const currency = asCurrency(row.currency);
  const shippingCurrency = asCurrency(row.shipping_currency || row.currency);
  // Hợp đồng cũ lưu thêm giá sản phẩm quy đổi theo tỷ giá; chỉ giữ loại tiền chính của hợp đồng.
  const storedProduct = moneyParts(body?.product);
  const mainProduct = storedProduct?.filter((item) => item.currency === currency) ?? [];
  const vndRates = vndRateMap((body as { vndRates?: unknown } | null)?.vndRates);
  return {
    product: mainProduct.length > 0 ? mainProduct : storedProduct ?? [{ currency, amount: moneyValue(row.product_value) }],
    shipping: moneyParts(body?.shipping) ?? [{ currency: shippingCurrency, amount: moneyValue(row.shipping_cost) }],
    ...(vndRates ? { vndRates } : {}),
  };
}

function vndRateMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([code, rate]) => {
    const parsed = typeof rate === "number" || typeof rate === "string" ? Number(rate) : NaN;
    return /^[A-Z]{3}$/.test(code) && Number.isFinite(parsed) && parsed > 0 ? [[code, parsed] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}


type ContractRow = {
  id: string;
  code: string;
  lane: CrmLane;
  quote_id: string;
  quote_code: string | null;
  customer_name: string;
  sale_name: string | null;
  ship_to: string | null;
  product: string | null;
  industry: IndustryCategory | null;
  quantity: string | number | null;
  currency: string;
  shipping_currency: string | null;
  amounts_body: unknown;
  product_value: string | number;
  shipping_cost: string | number;
  total_value: string | number;
  paid_amount: string | number;
  balance: string | number;
  payments: unknown;
  signed_on: Date | string | null;
  ops_status: string | null;
  tracking: string | null;
  note_1: string | null;
  note_2: string | null;
  china_warehouse_on: Date | string | null;
  container_on: Date | string | null;
  arrival_on: Date | string | null;
  delivery_on: Date | string | null;
  sent_to_accounting_at: Date | string | null;
  sent_to_ops_at: Date | string | null;
  confirmed_back_at: Date | string | null;
  confirmed_amount: string | number | null;
  accounting_status: string | null;
  confirmations: unknown;
  images: unknown;
  sent_ops_body: unknown;
  sent_accounting_body: unknown;
  sent_parties_body: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

const commercialSnapshotSql = `jsonb_build_object(
  'customerName', ten_khach_hang,
  'saleName', nhan_vien_ban,
  'shipTo', van_chuyen_den,
  'product', san_pham,
  'quantity', so_luong,
  'currency', loai_tien,
  'productValue', gia_tri_san_pham,
  'shippingCost', chi_phi_van_chuyen,
  'totalValue', tong_gia_tri,
  'paidAmount', so_tien_thanh_toan,
  'balance', so_tien_con_lai,
  'signedOn', to_char(ngay_ky, 'YYYY-MM-DD'),
  'opsStatus', coalesce(trang_thai_van_hanh, '')
)`;

const opsSnapshotSql = `coalesce(ban_gui_van_hanh, '{}'::jsonb) || jsonb_build_object(
  'tracking', coalesce(tracking, ''),
  'note1', coalesce(ghi_chu_1, ''),
  'note2', coalesce(ghi_chu_2, ''),
  'chinaWarehouseOn', to_char(ngay_nhap_kho_tq, 'YYYY-MM-DD'),
  'containerOn', to_char(ngay_xuat_container, 'YYYY-MM-DD'),
  'arrivalOn', to_char(ngay_cap_cang, 'YYYY-MM-DD'),
  'deliveryOn', to_char(ngay_giao_du_kien, 'YYYY-MM-DD'),
  'opsStatus', coalesce(trang_thai_van_hanh, '')
)`;

const accountingSnapshotSql = `jsonb_build_object(
  'confirmedAmount', so_tien_xac_nhan,
  'accountingStatus', trang_thai_ke_toan,
  'confirmations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'amount', x.so_tien,
      'currency', x.loai_tien,
      'exchangeRate', x.ty_gia,
      'note', coalesce(x.ghi_chu, ''),
      'images', coalesce(x.anh, '[]'::jsonb)
    ) order by x.thu_tu)
    from crm.hop_dong_dong_xac_nhan x
    where x.ma_hop_dong = crm.hop_dong.id
  ), '[]'::jsonb),
  'images', coalesce((
    select jsonb_agg(img order by thu_tu, idx)
    from (
      select x.thu_tu, ordinality as idx, img
      from crm.hop_dong_dong_xac_nhan x
      cross join lateral jsonb_array_elements_text(coalesce(x.anh, '[]'::jsonb)) with ordinality as t(img, ordinality)
      where x.ma_hop_dong = crm.hop_dong.id
    ) flat
  ), coalesce((
    select jsonb_agg(b.duong_dan order by b.thu_tu)
    from crm.hop_dong_anh_bill b
    where b.ma_hop_dong = crm.hop_dong.id
  ), '[]'::jsonb)),
  'opsStatus', coalesce(trang_thai_van_hanh, ''),
  'tracking', coalesce(ban_gui_ke_toan->>'tracking', ''),
  'note1', coalesce(ban_gui_ke_toan->>'note1', ''),
  'note2', coalesce(ban_gui_ke_toan->>'note2', ''),
  'chinaWarehouseOn', ban_gui_ke_toan->>'chinaWarehouseOn',
  'containerOn', ban_gui_ke_toan->>'containerOn',
  'arrivalOn', ban_gui_ke_toan->>'arrivalOn',
  'deliveryOn', ban_gui_ke_toan->>'deliveryOn'
)`;

function contractSelect(): string {
  return `
  select h.id::text as id, h.ma_hien_thi as code, h.tuyen as lane,
         h.ma_bao_gia::text as quote_id, h.ma_bao_gia_hien_thi as quote_code,
         h.ten_khach_hang as customer_name, h.nhan_vien_ban as sale_name,
         h.van_chuyen_den as ship_to, h.san_pham as product, h.nganh_hang as industry, h.so_luong as quantity,
         h.loai_tien as currency, h.loai_tien_van_chuyen as shipping_currency, h.khoan_tien as amounts_body,
         h.gia_tri_san_pham as product_value, h.chi_phi_van_chuyen as shipping_cost,
         h.tong_gia_tri as total_value, h.so_tien_thanh_toan as paid_amount, h.so_tien_con_lai as balance,
         coalesce(pays.payments, '[]'::jsonb) as payments,
         h.ngay_ky::text as signed_on, h.trang_thai_van_hanh as ops_status, h.tracking,
         h.ghi_chu_1 as note_1, h.ghi_chu_2 as note_2,
         h.ngay_nhap_kho_tq::text as china_warehouse_on, h.ngay_xuat_container::text as container_on,
         h.ngay_cap_cang::text as arrival_on, h.ngay_giao_du_kien::text as delivery_on,
         h.gui_ke_toan_luc as sent_to_accounting_at, h.gui_van_hanh_luc as sent_to_ops_at,
         h.gui_xac_nhan_luc as confirmed_back_at, h.so_tien_xac_nhan as confirmed_amount,
         h.trang_thai_ke_toan::text as accounting_status,
         coalesce(confs.confirmations, '[]'::jsonb) as confirmations,
         coalesce(imgs.images, '[]'::jsonb) as images,
         h.ban_gui_van_hanh as sent_ops_body, h.ban_gui_ke_toan as sent_accounting_body,
         h.ban_gui_xac_nhan as sent_parties_body, h.tao_luc as created_at, h.cap_nhat_luc as updated_at
  from crm.hop_dong h
  left join lateral (
    select jsonb_agg(b.duong_dan order by b.thu_tu) as images
    from crm.hop_dong_anh_bill b
    where b.ma_hop_dong = h.id
  ) imgs on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'amount', d.so_tien,
      'currency', d.loai_tien,
      'exchangeRate', d.ty_gia,
      'paidOn', to_char(d.ngay_chuyen, 'YYYY-MM-DD'),
      'note', coalesce(d.ghi_chu, ''),
      'images', coalesce(d.anh_bill, '[]'::jsonb)
    ) order by d.thu_tu) as payments
    from crm.hop_dong_dong_thanh_toan d
    where d.ma_hop_dong = h.id
  ) pays on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'amount', x.so_tien,
      'currency', x.loai_tien,
      'exchangeRate', x.ty_gia,
      'note', coalesce(x.ghi_chu, ''),
      'images', coalesce(x.anh, '[]'::jsonb)
    ) order by x.thu_tu) as confirmations
    from crm.hop_dong_dong_xac_nhan x
    where x.ma_hop_dong = h.id
  ) confs on true
`;
}

function imageList(value: unknown): string[] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => (typeof item === "string" ? [item] : []));
}

function paymentCurrency(value: unknown, fallback: string): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(code) ? code : asCurrency(fallback);
}

function paymentList(value: unknown, fallbackCurrency: string): ContractRecord["payments"] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const amount = typeof row.amount === "number" || typeof row.amount === "string" ? moneyValue(row.amount) : 0;
    const paidOn = typeof row.paidOn === "string" && row.paidOn ? row.paidOn.slice(0, 10) : null;
    const note = typeof row.note === "string" ? row.note : "";
    const images = imageList(row.images);
    const exchangeRate = typeof row.exchangeRate === "number" || typeof row.exchangeRate === "string" ? Number(row.exchangeRate) : null;
    return [{ amount, currency: paymentCurrency(row.currency, fallbackCurrency), exchangeRate: exchangeRate && exchangeRate > 0 ? exchangeRate : null, paidOn, note, images }];
  });
}

function confirmationList(value: unknown, fallbackCurrency: string): ContractRecord["confirmations"] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const amount = typeof row.amount === "number" || typeof row.amount === "string" ? moneyValue(row.amount) : 0;
    const note = typeof row.note === "string" ? row.note : "";
    const images = imageList(row.images);
    const exchangeRate = typeof row.exchangeRate === "number" || typeof row.exchangeRate === "string" ? Number(row.exchangeRate) : null;
    return [{ amount, currency: paymentCurrency(row.currency, fallbackCurrency), exchangeRate: exchangeRate && exchangeRate > 0 ? exchangeRate : null, note, images }];
  });
}

function toContract(row: ContractRow): ContractRecord {
  const payments = paymentList(row.payments, row.currency);
  const paidAmount = moneyValue(row.paid_amount);
  const confirmations = confirmationList(row.confirmations, row.currency);
  const confirmedAmount = row.confirmed_amount == null ? null : moneyValue(row.confirmed_amount);
  const confirmationImages = confirmations.flatMap((line) => line.images);
  return {
    id: row.id,
    code: row.code,
    lane: row.lane,
    quoteId: row.quote_id,
    quoteCode: row.quote_code ?? "",
    customerName: row.customer_name,
    saleName: row.sale_name,
    shipTo: row.ship_to,
    product: row.product,
    industry: row.industry,
    quantity: row.quantity == null ? null : moneyValue(row.quantity),
    currency: asCurrency(row.currency),
    productValue: moneyValue(row.product_value),
    shippingCost: moneyValue(row.shipping_cost),
    amounts: amountsFromRow(row),
    totalValue: moneyValue(row.total_value),
    paidAmount,
    payments: payments.length > 0
      ? payments
      : paidAmount > 0
        ? [{ amount: paidAmount, currency: asCurrency(row.currency), exchangeRate: null, paidOn: null, note: "", images: [] }]
        : [],
    balance: moneyValue(row.balance),
    signedOn: dayText(row.signed_on),
    opsStatus: row.ops_status ?? "",
    tracking: row.tracking ?? "",
    note1: row.note_1 ?? "",
    note2: row.note_2 ?? "",
    chinaWarehouseOn: dayText(row.china_warehouse_on),
    containerOn: dayText(row.container_on),
    arrivalOn: dayText(row.arrival_on),
    deliveryOn: dayText(row.delivery_on),
    sentToAccountingAt: row.sent_to_accounting_at ? stamp(row.sent_to_accounting_at) : null,
    sentToOpsAt: row.sent_to_ops_at ? stamp(row.sent_to_ops_at) : null,
    confirmedBackAt: row.confirmed_back_at ? stamp(row.confirmed_back_at) : null,
    confirmedAmount,
    accountingStatus: row.accounting_status,
    confirmations: confirmations.length > 0
      ? confirmations
      : confirmedAmount != null && confirmedAmount > 0
        ? [{ amount: confirmedAmount, currency: asCurrency(row.currency), exchangeRate: null, note: "", images: imageList(row.images) }]
        : [],
    images: (() => {
      if (confirmationImages.length > 0) return confirmationImages;
      const fromPayments = payments.flatMap((line) => line.images);
      return fromPayments.length > 0 ? fromPayments : imageList(row.images);
    })(),
    createdAt: stamp(row.created_at),
    updatedAt: stamp(row.updated_at),
  };
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

function snapText(source: Record<string, unknown> | null, key: string): string {
  const value = source?.[key];
  return typeof value === "string" ? value : "";
}

function snapNullableText(source: Record<string, unknown> | null, key: string): string | null {
  const value = snapText(source, key);
  return value || null;
}

function snapMoney(source: Record<string, unknown> | null, key: string): number {
  const value = source?.[key];
  if (typeof value === "number" || typeof value === "string") return moneyValue(value);
  return 0;
}

function applyCommercial(base: ContractRecord, source: Record<string, unknown> | null): ContractRecord {
  if (!source) {
    return {
      ...base,
      customerName: "",
      saleName: null,
      shipTo: null,
      product: null,
      quantity: null,
      productValue: 0,
      shippingCost: 0,
      totalValue: 0,
      paidAmount: 0,
      payments: [],
      balance: 0,
      signedOn: null,
    };
  }
  const quantity = source.quantity;
  const paidAmount = snapMoney(source, "paidAmount");
  return {
    ...base,
    customerName: snapText(source, "customerName"),
    saleName: snapNullableText(source, "saleName"),
    shipTo: snapNullableText(source, "shipTo"),
    product: snapNullableText(source, "product"),
    quantity: quantity == null || quantity === "" ? null : snapMoney(source, "quantity"),
    currency: asCurrency(source.currency),
    productValue: snapMoney(source, "productValue"),
    shippingCost: snapMoney(source, "shippingCost"),
    totalValue: snapMoney(source, "totalValue"),
    paidAmount,
    payments: paymentList(source.payments, asCurrency(source.currency)).length > 0 ? paymentList(source.payments, asCurrency(source.currency))
      : paidAmount > 0 ? [{ amount: paidAmount, currency: asCurrency(source.currency), exchangeRate: null, paidOn: null, note: "", images: [] }] : [],
    balance: snapMoney(source, "balance"),
    signedOn: snapNullableText(source, "signedOn"),
  };
}

function applyOpsDetails(base: ContractRecord, source: Record<string, unknown> | null): ContractRecord {
  return {
    ...base,
    tracking: snapText(source, "tracking"),
    note1: snapText(source, "note1"),
    note2: snapText(source, "note2"),
    chinaWarehouseOn: snapNullableText(source, "chinaWarehouseOn"),
    containerOn: snapNullableText(source, "containerOn"),
    arrivalOn: snapNullableText(source, "arrivalOn"),
    deliveryOn: snapNullableText(source, "deliveryOn"),
  };
}

function applyAccounting(base: ContractRecord, source: Record<string, unknown> | null): ContractRecord {
  if (!source) return { ...base, confirmedAmount: null, accountingStatus: null, confirmations: [], images: [] };
  const amount = source.confirmedAmount;
  const confirmations = confirmationList(source.confirmations, base.currency);
  const confirmedAmount = amount == null || amount === "" ? null : moneyValue(typeof amount === "number" || typeof amount === "string" ? amount : null);
  const images = confirmations.flatMap((line) => line.images);
  return {
    ...base,
    confirmedAmount,
    accountingStatus: typeof source.accountingStatus === "string" ? source.accountingStatus : null,
    confirmations: confirmations.length > 0
      ? confirmations
      : confirmedAmount != null && confirmedAmount > 0
        ? [{ amount: confirmedAmount, currency: base.currency, exchangeRate: null, note: "", images: imageList(source.images) }]
        : [],
    images: images.length > 0 ? images : imageList(source.images),
  };
}

function projectContract(row: ContractRow, view: ContractView): ContractRecord {
  const live = toContract(row);
  const sentToOps = jsonObject(row.sent_ops_body);
  const sentToAccounting = jsonObject(row.sent_accounting_body);
  // Trạng thái/số tiền/ảnh kế toán luôn lấy bản live để Sale/VH thấy đủ điều kiện đi hàng, giục TT...
  if (view === "sale") return live;
  if (view === "ops") {
    const projected = applyCommercial(live, sentToOps);
    return {
      ...projected,
      // Tiền/bill và trạng thái kế toán lấy bản live để cột giục TT / đủ điều kiện khớp thực tế.
      paidAmount: live.paidAmount,
      payments: live.payments,
      balance: live.balance,
      totalValue: live.totalValue,
      currency: live.currency,
      confirmedAmount: live.confirmedAmount,
      accountingStatus: live.accountingStatus,
      confirmations: live.confirmations,
      images: live.images,
      deliveryOn: live.deliveryOn,
      opsStatus: live.opsStatus,
    };
  }
  const received = applyOpsDetails(applyCommercial(live, sentToAccounting), sentToAccounting);
  return {
    ...received,
    payments: live.payments,
    paidAmount: live.paidAmount,
    balance: live.balance,
    totalValue: live.totalValue,
    currency: live.currency,
    deliveryOn: live.deliveryOn,
    opsStatus: live.opsStatus,
    confirmedAmount: live.confirmedAmount,
    accountingStatus: live.accountingStatus,
    confirmations: live.confirmations,
    images: live.images,
  };
}

function toMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    messCode: row.mess_code,
    source: row.source,
    customerName: row.customer_name_raw,
    phone: row.phone,
    email: row.email,
    status: row.status,
    goods: row.goods,
    industry: row.industry,
    demand: row.demand,
    customerType: row.customer_type,
    note: row.note,
    market: row.market,
    classification: row.classification,
    saleName: row.sale_name,
    painPoint: row.pain_point,
    linkMess: row.link_mess,
    brand: row.brand,
    order: messageOrder(row.order_info),
    receivedAt: stamp(row.received_at),
    leadId: row.lead_id,
    leadCode: row.lead_code,
  };
}

/** Nháp đơn hàng trên mess. Dữ liệu hỏng thì coi như chưa có, không làm hỏng cả danh sách. */
function messageOrder(value: unknown): QuoteOrder | null {
  const parsed = quoteOrderSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toPotential(row: PotentialRow): PotentialRecord {
  const orders = asOrders(row.order_lines);
  const order = sourcingHandoffOrder({ orders }) ?? (row.logistics_class === "FCL" ? null : messageOrder(row.order_info));
  const packages = order?.lines.flatMap((line) => line.packages) ?? [];
  const dimensions = [...new Set(packages
    .filter((pkg) => pkg.lengthCm > 0 && pkg.widthCm > 0 && pkg.heightCm > 0)
    .map((pkg) => `${pkg.lengthCm} × ${pkg.widthCm} × ${pkg.heightCm} cm`))].join("; ");
  // Cân thực tế theo số kiện; weightKg trên dòng có thể là cân quy đổi tính cước.
  const actualKg = packages.reduce((total, pkg) => total + pkg.actualKg * pkg.count, 0);
  return {
    id: row.id,
    leadCode: row.lead_code,
    messId: row.mess_id,
    messCode: row.mess_code,
    fullName: row.full_name,
    companyName: row.company_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    productInterest: row.product_interest,
    industry: row.industry,
    quantityNote: row.quantity_note,
    address: row.address,
    saleNote: row.sale_note,
    potential: row.potential,
    status: row.status,
    sourcingQuoteStatus: null,
    logisticsQuoteStatus: null,
    customerKind: row.customer_kind,
    quoteWorkflow: row.quote_workflow,
    customerType: row.customer_type,
    brand: row.brand,
    careChannel: row.care_channel,
    classification: row.classification,
    packSpec: row.pack_spec,
    packageDimensions: row.package_dimensions?.trim() || dimensions || null,
    weightKg: row.weight_kg?.trim() || (actualKg > 0 ? `${Number(actualKg.toFixed(3))} kg` : null),
    logisticsClass: row.logistics_class,
    shippingMode: row.shipping_mode,
    shipFromAddress: row.ship_from_address,
    shipToAddress: row.ship_to_address,
    linkMess: row.link_mess,
    requirements: row.requirements,
    requirementImages: imageList(row.requirement_images),
    convertReason: row.convert_reason,
    createdAt: stamp(row.created_at),
  };
}

function raise(cause: unknown): never {
  if (cause instanceof AppError) throw cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = String((cause as { code: unknown }).code);
    const message = String((cause as { message?: unknown }).message ?? "").split("\n")[0] ?? "";
    if (code === "23505") throw new AppError(409, "CONFLICT", "Dữ liệu bị trùng");
    if (code === "23503") throw new AppError(409, "CONFLICT", "Mess đang gắn với khách hàng tiềm năng");
    if (code === "23514" || code === "42501") throw new AppError(400, "RULE", message.slice(0, 200) || "Dữ liệu không hợp lệ");
    if (code === "22P02") throw new AppError(400, "VALIDATION_ERROR", "Giá trị không hợp lệ");
  }
  throw new InfrastructureError("database query failed", { cause });
}

export class PostgresCrmRepository implements CrmRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listMessages(lane: CrmLane, search: MessageListSearch): Promise<MessageRecord[]> {
    const { message: messageTable, potential: potentialTable } = laneTables[lane];
    const compiled = messageSearch(search).build();
    const result = await this.query<MessageRow>(
      `${messageSelect(messageTable, potentialTable)} where true ${compiled.sql} order by m.tao_luc desc limit 200`,
      compiled.values,
    );
    return result.rows.map(toMessage);
  }

  async createMessage(lane: CrmLane, input: CreateMessageInput): Promise<MessageRecord> {
    const { message: messageTable } = laneTables[lane];
    const inserted = await this.query<{ id: string }>(
      `insert into ${messageTable} (
         ten_khach_hang_tho, so_dien_thoai, thu_dien_tu, hang_hoa, nhu_cau, loai_khach_hang, ghi_chu,
         nhan_luc, thi_truong, phan_loai, nhan_vien_ban, ghi_chu_van_de, link_mess, nganh_hang, thong_tin_don_hang, nguon,
         thuong_hieu
       )
       values (
         $1, $2, $3, $4, $5::text::crm.message_demand, $6::text::crm.customer_type, $7,
         coalesce($8::timestamptz, now()), $9, $10::text::crm.message_classification, $11, $12, $13, $14, $15::jsonb,
         coalesce($16::text::crm.lead_source, 'ADS'::crm.lead_source), $17::text::crm.lead_brand
       )
       returning id::text as id`,
      [
        input.customerName,
        blank(input.phone),
        blank(input.email),
        blank(input.goods),
        input.demand ?? null,
        input.customerType ?? null,
        blank(input.note),
        receivedAt(input.receivedOn),
        blank(input.market),
        input.classification ?? null,
        blank(input.saleName),
        blank(input.painPoint),
        blank(input.linkMess),
        input.industry ?? null,
        input.order ? JSON.stringify(input.order) : null,
        input.source ?? null,
        input.brand ?? null,
      ],
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new InfrastructureError("insert message returned no row");
    const row = await this.findMessage(lane, id);
    if (!row) throw new InfrastructureError("message missing after insert");
    return row;
  }

  async updateMessage(lane: CrmLane, id: string, input: UpdateMessageInput): Promise<MessageRecord | null> {
    const { message: messageTable, potential: potentialTable } = laneTables[lane];
    const updated = await this.query<{ id: string }>(
      `update ${messageTable} set
         ten_khach_hang_tho = $2,
         so_dien_thoai = $3,
         thu_dien_tu = $4,
         hang_hoa = $5,
         nhu_cau = $6::text::crm.message_demand,
         loai_khach_hang = $7::text::crm.customer_type,
         ghi_chu = $8,
         nhan_luc = coalesce($9::timestamptz, nhan_luc),
         thi_truong = $10,
         phan_loai = $11::text::crm.message_classification,
         nhan_vien_ban = $12,
         ghi_chu_van_de = $13,
         link_mess = $14,
         nganh_hang = $15,
         thong_tin_don_hang = case when $16::boolean then $17::jsonb else thong_tin_don_hang end,
         thuong_hieu = $18::text::crm.lead_brand
       where id = $1::uuid
       returning id::text as id`,
      [
        id,
        input.customerName,
        blank(input.phone),
        blank(input.email),
        blank(input.goods),
        input.demand ?? null,
        input.customerType ?? null,
        blank(input.note),
        receivedAt(input.receivedOn),
        blank(input.market),
        input.classification ?? null,
        blank(input.saleName),
        blank(input.painPoint),
        blank(input.linkMess),
        input.industry ?? null,
        input.order !== undefined,
        input.order ? JSON.stringify(input.order) : null,
        input.brand ?? null,
      ],
    );
    if (!updated.rows[0]) return null;
    // Khách tiềm năng lấy Nguồn theo mess gốc.
    await this.query(
      `update ${potentialTable} set
         ho_ten = $2,
         so_dien_thoai = $3,
         thu_dien_tu = $4,
         san_pham_quan_tam = $5,
         thuong_hieu = coalesce($6::text::crm.lead_brand, thuong_hieu)
       where ma_tin_nhan = $1::uuid and xoa_luc is null`,
      [id, input.customerName, blank(input.phone), blank(input.email), blank(input.goods), input.brand ?? null],
    );
    return this.findMessage(lane, id);
  }

  async deleteMessage(lane: CrmLane, id: string): Promise<"ok" | "missing" | "linked"> {
    const { message: messageTable, potential: potentialTable } = laneTables[lane];
    return this.transaction(async (client) => {
      const found = await client.query(`select id from ${messageTable} where id = $1::uuid`, [id]);
      if (!found.rowCount) return "missing";
      const linked = await client.query(`select 1 from ${potentialTable} where ma_tin_nhan = $1::uuid`, [id]);
      if (linked.rowCount) return "linked";
      await client.query(`delete from ${messageTable} where id = $1::uuid`, [id]);
      return "ok";
    });
  }

  async convertMessage(lane: CrmLane, id: string, input: ConvertMessageInput): Promise<{ message: MessageRecord; potential: PotentialRecord } | "missing" | "lost"> {
    const { message: messageTable, potential: potentialTable } = laneTables[lane];
    return this.transaction(async (client) => {
      const locked = await client.query<{ status: string; source: string; customer_name_raw: string | null; phone: string | null; email: string | null; goods: string | null; demand: string | null; customer_type: string | null; note: string | null; brand: string | null }>(
        `select trang_thai::text as status, nguon::text as source, ten_khach_hang_tho as customer_name_raw, thuong_hieu::text as brand,
                so_dien_thoai as phone, thu_dien_tu as email, hang_hoa as goods, nhu_cau::text as demand,
                loai_khach_hang::text as customer_type, ghi_chu as note
         from ${messageTable} where id = $1::uuid for update`,
        [id],
      );
      const message = locked.rows[0];
      if (!message) return "missing";
      if (message.status === "LOST") return "lost";
      if (!message.demand) throw new AppError(400, "VALIDATION_ERROR", "Chọn nhu cầu trước khi chuyển");
      if (message.demand === "SHIPPING" && (!input.shippingMode || (input.shippingMode === "SEA" && !input.logisticsClass))) {
        throw new AppError(400, "VALIDATION_ERROR", "Chọn đường bay hoặc đường biển và loại LCL/FCL nếu đi biển");
      }
      // Nguồn đi theo mess; chỉ nhận nguồn gửi lên khi mess chưa có.
      const brand = message.brand ?? input.brand ?? null;
      if (!brand) throw new AppError(400, "VALIDATION_ERROR", "Chọn Nguồn trên mess trước khi chuyển");
      if (!message.brand) await client.query(`update ${messageTable} set thuong_hieu = $2::text::crm.lead_brand where id = $1::uuid`, [id, brand]);

      const existing = await client.query<PotentialRow>(
        `${potentialSelect(lane)} and l.ma_tin_nhan = $1::uuid`,
        [id],
      );
      let potential = existing.rows[0];
      const requirements = blank(input.requirements);
      const reason = blank(input.reason);
      const imagesJson = JSON.stringify(input.images ?? []);
      if (!potential) {
        const kind = message.demand === "SHIPPING" ? "LOGISTICS" : message.demand === "SOURCING" ? "SOURCING" : null;
        const inserted = await client.query<{ id: string }>(
          `insert into ${potentialTable} (
             nguon, ho_ten, so_dien_thoai, thu_dien_tu, san_pham_quan_tam, tiem_nang, trang_thai, ma_tin_nhan,
             nhom_khach, loai_khach_hang, ghi_chu_ban_hang, yeu_cau_khach, anh_yeu_cau, ly_do_chuyen,
             ghi_chu_so_luong, kich_thuoc_kien_hang, trong_luong_kg, dia_chi_gui, dia_chi_nhan,
             phuong_thuc_van_chuyen, phan_loai, phan_loai_logistics,
             ten_cong_ty, dia_chi, thuong_hieu, kenh_cham_soc
           )
           values (
             $2::crm.lead_source, $3, $4, $5, $6, 'POTENTIAL'::crm.potential_status, 'NEW', $1::uuid,
             $7::text::crm.customer_kind, $8::text::crm.customer_type, $9, $10, $11::jsonb, $12,
             $13, $14, $15, $16, $17, $18, $19::text::crm.lead_classification, $19,
             null, $20, $21::text::crm.lead_brand, $22
           )
           returning id::text as id`,
          [id, message.source, message.customer_name_raw, input.phone, message.email, input.productInterest, kind, input.customerType, input.saleNote, requirements, imagesJson, reason, blank(input.quantityNote), blank(input.packageDimensions), blank(input.weightKg), blank(input.shipFromAddress), blank(input.shipToAddress), input.shippingMode ?? null, input.logisticsClass ?? null, input.address, brand, input.careChannel],
        );
        const leadId = inserted.rows[0]?.id;
        if (!leadId) throw new InfrastructureError("insert lead returned no row");
        const loaded = await client.query<PotentialRow>(`${potentialSelect(lane)} and l.id = $1::uuid`, [leadId]);
        potential = loaded.rows[0];
        if (!potential) throw new InfrastructureError("lead missing after insert");
      } else {
        const kind = message.demand === "SHIPPING" ? "LOGISTICS" : message.demand === "SOURCING" ? "SOURCING" : null;
        await client.query(
          `update ${potentialTable}
           set yeu_cau_khach = $2, anh_yeu_cau = $3::jsonb, ly_do_chuyen = $4,
               ghi_chu_so_luong = coalesce($5, ghi_chu_so_luong),
               kich_thuoc_kien_hang = coalesce($6, kich_thuoc_kien_hang),
               trong_luong_kg = coalesce($7, trong_luong_kg),
               dia_chi_gui = coalesce($8, dia_chi_gui), dia_chi_nhan = coalesce($9, dia_chi_nhan),
               nhom_khach = coalesce($10::text::crm.customer_kind, nhom_khach),
               phuong_thuc_van_chuyen = coalesce($11, phuong_thuc_van_chuyen),
               phan_loai = case when $11::text is null then phan_loai else $12::text::crm.lead_classification end,
               phan_loai_logistics = case when $11::text is null then phan_loai_logistics else $12 end,
               so_dien_thoai = $13, san_pham_quan_tam = $14, loai_khach_hang = $15::text::crm.customer_type,
               ghi_chu_ban_hang = $16, dia_chi = $17, thuong_hieu = $18::text::crm.lead_brand, kenh_cham_soc = $19
           where id = $1::uuid`,
          [potential.id, requirements, imagesJson, reason, blank(input.quantityNote), blank(input.packageDimensions), blank(input.weightKg), blank(input.shipFromAddress), blank(input.shipToAddress), kind, input.shippingMode ?? null, input.logisticsClass ?? null, input.phone, input.productInterest, input.customerType, input.saleNote, input.address, brand, input.careChannel],
        );
        const loaded = await client.query<PotentialRow>(`${potentialSelect(lane)} and l.id = $1::uuid`, [potential.id]);
        potential = loaded.rows[0] ?? potential;
      }

      if (message.status !== "CONVERTED") {
        await client.query(`update ${messageTable} set trang_thai = 'CONVERTED' where id = $1::uuid`, [id]);
      }

      const refreshed = await client.query<MessageRow>(`${messageSelect(messageTable, potentialTable)} where m.id = $1::uuid`, [id]);
      const row = refreshed.rows[0];
      if (!row) throw new InfrastructureError("message missing after convert");
      return { message: toMessage(row), potential: toPotential(potential) };
    });
  }

  async listPotentials(lane: CrmLane, search: PotentialListSearch): Promise<PotentialRecord[]> {
    const compiled = potentialSearch(search).build();
    const result = await this.query<PotentialRow>(
      `${potentialSelect(lane)} ${compiled.sql} order by l.tao_luc desc limit 200`,
      compiled.values,
    );
    const potentials = result.rows.map(toPotential);
    if (potentials.length === 0) return potentials;
    const { sourcing, logistics } = quoteTables[lane];
    const statuses = await this.query<{ potential_id: string; desk: "sourcing" | "logistics"; status: string }>(
      `select distinct on (potential_id, desk) potential_id, desk, status
       from (
         select q.ma_khach_hang_tiem_nang::text as potential_id, 'sourcing' as desk,
                q.trang_thai_bao_gia::text as status, q.tao_luc as created_at
         from ${sourcing} q where q.ma_khach_hang_tiem_nang = any($1::uuid[])
         union all
         select q.ma_khach_hang_tiem_nang::text, 'logistics',
                q.trang_thai_bao_gia::text, q.tao_luc
         from ${logistics} q where q.ma_khach_hang_tiem_nang = any($1::uuid[])
         union all
         select q.ma_khach_hang_tiem_nang::text, 'logistics',
                q.bao_gia_logistics->>'quoteStatus', q.tao_luc
         from ${sourcing} q
         where q.ma_khach_hang_tiem_nang = any($1::uuid[])
           and q.bao_gia_logistics->>'quoteStatus' is not null
       ) quotes
       order by potential_id, desk, created_at desc`,
      [potentials.map((row) => row.id)],
    );
    const byId = new Map(potentials.map((row) => [row.id, row]));
    for (const { potential_id, desk, status } of statuses.rows) {
      const row = byId.get(potential_id);
      if (row) row[desk === "sourcing" ? "sourcingQuoteStatus" : "logisticsQuoteStatus"] = status;
    }
    return potentials;
  }

  async updatePotential(lane: CrmLane, id: string, input: UpdatePotentialInput): Promise<PotentialRecord | null> {
    const { potential: potentialTable } = laneTables[lane];
    const updated = await this.query<{ id: string }>(
      `update ${potentialTable} set
         ho_ten = $2,
         ten_cong_ty = $3,
         so_dien_thoai = $4,
         thu_dien_tu = $5,
         san_pham_quan_tam = $6,
         ghi_chu_so_luong = $7,
         dia_chi = $8,
         ghi_chu_ban_hang = $9,
         tiem_nang = $10::crm.potential_status,
         nhom_khach = $11::text::crm.customer_kind,
         loai_khach_hang = $12::text::crm.customer_type,
         thuong_hieu = $13::text::crm.lead_brand,
         kenh_cham_soc = $14,
         phan_loai = $15::text::crm.lead_classification,
         quy_cach_dong_goi = coalesce($16, quy_cach_dong_goi),
         trong_luong_kg = case when $17::text is null then trong_luong_kg else nullif(btrim($17), '') end,
         phan_loai_logistics = $18,
         dia_chi_gui = $19,
         dia_chi_nhan = $20,
         yeu_cau_khach = coalesce($21, yeu_cau_khach),
         anh_yeu_cau = coalesce($22::jsonb, anh_yeu_cau),
         ly_do_chuyen = coalesce($23, ly_do_chuyen),
         kich_thuoc_kien_hang = case when $24::text is null then kich_thuoc_kien_hang else nullif(btrim($24), '') end,
         phuong_thuc_van_chuyen = coalesce($25, phuong_thuc_van_chuyen)
       where id = $1::uuid and xoa_luc is null and tiem_nang is not null
       returning id::text as id`,
      [
        id,
        input.fullName,
        blank(input.companyName),
        blank(input.phone),
        blank(input.email),
        blank(input.productInterest),
        blank(input.quantityNote),
        blank(input.address),
        blank(input.saleNote),
        input.potential,
        input.customerKind ?? null,
        input.customerType ?? null,
        input.brand ?? null,
        blank(input.careChannel),
        input.classification ?? null,
        blank(input.packSpec),
        input.weightKg ?? null,
        blank(input.logisticsClass),
        blank(input.shipFromAddress),
        blank(input.shipToAddress),
        input.requirements === undefined ? null : blank(input.requirements),
        input.requirementImages === undefined ? null : JSON.stringify(input.requirementImages),
        input.convertReason === undefined ? null : blank(input.convertReason),
        input.packageDimensions ?? null,
        input.shippingMode ?? null,
      ],
    );
    if (!updated.rows[0]) return null;
    const result = await this.query<PotentialRow>(`${potentialSelect(lane)} and l.id = $1::uuid`, [id]);
    const row = result.rows[0];
    return row ? toPotential(row) : null;
  }

  async deletePotential(lane: CrmLane, id: string): Promise<boolean> {
    const { message: messageTable, potential: potentialTable } = laneTables[lane];
    return this.transaction(async (client) => {
      const removed = await client.query<{ mess_id: string | null }>(
        `with old as (
           select id, ma_tin_nhan
           from ${potentialTable}
           where id = $1::uuid and xoa_luc is null and tiem_nang is not null
         )
         update ${potentialTable} l
         set xoa_luc = now(), ma_tin_nhan = null
         from old
         where l.id = old.id
         returning old.ma_tin_nhan::text as mess_id`,
        [id],
      );
      const messId = removed.rows[0]?.mess_id;
      if (!removed.rowCount) return false;
      if (messId) {
        await client.query(
          `update ${messageTable} set trang_thai = 'QUALIFIED'
           where id = $1::uuid
             and trang_thai = 'CONVERTED'
             and not exists (
               select 1 from ${potentialTable} where ma_tin_nhan = $1::uuid and xoa_luc is null
             )`,
          [messId],
        );
      }
      return true;
    });
  }

  async listQuotes(
    lane: CrmLane,
    desk: QuoteDesk,
    search: QuoteListSearch,
    allowedKinds: readonly string[] | null = null,
  ): Promise<QuoteRecord[]> {
    if (allowedKinds && allowedKinds.length === 0) return [];
    const tables = quoteTables[lane];
    const own = quoteSearch(search, sql("q.trang_thai_bao_gia::text"), sql("q.trang_thai_hop_dong::text")).build();
    if (desk === "sourcing") {
      const kindFilter = kindClause(allowedKinds, own.values.length + 1);
      const result = await this.query<QuoteRow>(
        `${quoteSelect(tables.sourcing, tables.potential, tables.message, tables.logistics, true)} ${own.sql}${kindFilter.sql} order by q.tao_luc desc limit 200`,
        [...own.values, ...kindFilter.values],
      );
      return result.rows.map(toQuote);
    }
    const allowOwn = !allowedKinds || allowedKinds.includes("LOGISTICS");
    const allowShared = !allowedKinds || allowedKinds.includes("SOURCING_LOGISTICS");
    const shared = quoteSearch(search, sql("q.bao_gia_logistics->>'quoteStatus'"), sql("q.bao_gia_logistics->>'contractStatus'")).build();
    const noRows = Promise.resolve({ rows: [] as QuoteRow[] });
    const [ownRows, sharedRows] = await Promise.all([
      allowOwn
        ? this.query<QuoteRow>(
            `${quoteSelect(tables.logistics, tables.potential, tables.message, null, false)} ${own.sql} and l.nhom_khach::text = 'LOGISTICS' order by q.tao_luc desc limit 200`,
            own.values,
          )
        : noRows,
      allowShared
        ? this.query<QuoteRow>(
            `${quoteSelect(tables.sourcing, tables.potential, tables.message, null, true)} ${shared.sql} and ${COMBINED_HANDED_OFF_SQL} order by q.tao_luc desc limit 200`,
            shared.values,
          )
        : noRows,
    ]);
    return [...ownRows.rows.map(toQuote), ...sharedRows.rows.map(toLogisticsQuote)]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async listRfqQuotes(lane: CrmLane, search: QuoteListSearch, desk: "" | "sourcing" | "logistics"): Promise<RfqQuoteRecord[]> {
    const [sourcing, logistics] = await Promise.all([
      desk === "logistics" ? Promise.resolve([]) : this.listQuotes(lane, "sourcing", search),
      desk === "sourcing" ? Promise.resolve([]) : this.listQuotes(lane, "logistics", search),
    ]);
    // Keep a combined order visible when filtering RFQ by the Logistics desk.
    const combinedLogistics = desk === "logistics"
      ? (await Promise.all(logistics.filter(isCombinedSourcing).map((quote) => this.findQuote(lane, "sourcing", quote.id))))
        .filter((quote): quote is QuoteRecord => quote !== null)
      : [];
    return [
      ...[...sourcing, ...combinedLogistics].map((quote) => ({ ...quote, desk: "sourcing" as const })),
      ...logistics
        .filter((quote) => !isCombinedSourcing(quote))
        .map((quote) => ({ ...quote, desk: "logistics" as const })),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async reassignRfqQuote(lane: CrmLane, id: string, potentialId: string): Promise<ReassignQuoteResult> {
    const tables = quoteTables[lane];
    const sourcing = await this.findQuote(lane, "sourcing", id);
    const current = sourcing ?? await this.findQuote(lane, "logistics", id);
    if (!current) return "missing";
    const desk: QuoteDesk = sourcing ? "sourcing" : "logistics";
    const found = await this.query<{ customer_kind: string | null; quote_workflow: QuoteWorkflow }>(
      `select nhom_khach::text as customer_kind, luong_bao_gia as quote_workflow
       from ${tables.potential}
       where id = $1::uuid and xoa_luc is null`,
      [potentialId],
    );
    if (!found.rowCount) return "missing";
    const allowed = desksForKind(quoteAccessKind({ customerKind: found.rows[0].customer_kind, quoteWorkflow: found.rows[0].quote_workflow }));
    if (allowed.length === 0) return "kind";
    if (!allowed.includes(desk)) return "desk";
    // A reassignment cannot silently change the structure of an existing quote.
    if (current.quoteWorkflow !== found.rows[0].quote_workflow && desk === "sourcing") return "desk";
    if (desk === "logistics" && found.rows[0].customer_kind !== "LOGISTICS") return "desk";
    const taken = await this.query(
      `select 1 from ${tables[desk]}
       where ma_khach_hang_tiem_nang = $1::uuid and id <> $2::uuid`,
      [potentialId, id],
    );
    if (taken.rowCount) return "taken";
    const updated = await this.query(
      `update ${tables[desk]}
       set ma_khach_hang_tiem_nang = $2::uuid
       where id = $1::uuid`,
      [id, potentialId],
    );
    if (!updated.rowCount) return "missing";
    return (await this.findQuote(lane, desk, id)) ?? "missing";
  }

  async deleteRfqQuote(lane: CrmLane, id: string): Promise<boolean> {
    const tables = quoteTables[lane];
    for (const desk of ["sourcing", "logistics"] as const) {
      const removed = await this.query(`delete from ${tables[desk]} where id = $1::uuid`, [id]);
      if (removed.rowCount) return true;
    }
    return false;
  }

  async requestQuote(lane: CrmLane, potentialId: string) {
    const tables = quoteTables[lane];
    const found = await this.query<{ customer_kind: string | null; quote_workflow: QuoteWorkflow }>(
      `select nhom_khach::text as customer_kind, luong_bao_gia as quote_workflow
       from ${tables.potential}
       where id = $1::uuid and xoa_luc is null`,
      [potentialId],
    );
    if (!found.rowCount) return "missing" as const;
    const kind = found.rows[0]?.customer_kind;
    if (kind !== "SOURCING" && kind !== "LOGISTICS") return "kind" as const;
    const desk: QuoteDesk = kind === "LOGISTICS" ? "logistics" : "sourcing";
    const inserted = await this.query(
      `insert into ${tables[desk]} (ma_khach_hang_tiem_nang)
       values ($1::uuid)
       on conflict (ma_khach_hang_tiem_nang) do nothing`,
      [potentialId],
    );
    // Khách Sourcing kết hợp: báo giá chỉ nằm ở bàn Sourcing. Phiếu Logistics tạo khi Sourcing chuyển sang.
    const quote = await this.findQuoteByPotential(lane, desk, potentialId);
    if (!quote) return "missing" as const;
    return { quote, created: (inserted.rowCount ?? 0) > 0, desk };
  }

  async requestLogisticsQuote(lane: CrmLane, sourcingQuoteId: string) {
    const sourcing = await this.findQuote(lane, "sourcing", sourcingQuoteId);
    if (!sourcing) return "missing" as const;
    if (!isCombinedSourcing(sourcing)) return "kind" as const;
    // Logistics phải nhận được thông tin đơn hàng, không nhận phiếu trống.
    const order = sourcingHandoffOrder(sourcing);
    if (!order) return "empty" as const;
    const handoffSheet = handoffSheetOf([logisticsOrderFromSourcing(order)]);
    const updated = await this.query(
      `update ${quoteTables[lane].sourcing}
       set bao_gia_logistics = ${mergeHandoffSql("$2")}
       where id = $1::uuid and (bao_gia_logistics is null
         or bao_gia_logistics->>'handoffAt' is null
         or (${LOGISTICS_SHEET_UNSEEDED_SQL}))`,
      [sourcingQuoteId, JSON.stringify(handoffSheet)],
    );
    const quote = await this.findQuote(lane, "sourcing", sourcingQuoteId);
    if (!quote) return "missing" as const;
    return { quote, created: (updated.rowCount ?? 0) > 0 };
  }

  async updateQuote(lane: CrmLane, desk: QuoteDesk, id: string, input: UpdateQuoteInput) {
    if (desk === "logistics" && await this.sharedLogistics(lane, id)) return this.updateSharedLogistics(lane, id, input);
    if (input.templateId) {
      const template = await this.query(
        `select 1 from crm.mau_bao_gia where id = $1::uuid and ban = $2::crm.ban_bao_gia`,
        [input.templateId, banOf(desk)],
      );
      if (!template.rowCount) return "template" as const;
    }
    const updated = await this.query(
      `update ${quoteTables[lane][desk]}
       set ma_mau = $2::uuid,
           ghi_chu_vh = $3,
           trang_thai_bao_gia = $4::crm.trang_thai_bao_gia,
           trang_thai_hop_dong = $5::crm.trang_thai_hop_dong_bao_gia,
           chi_tiet_don_hang = $6::jsonb,
           ghi_chu = $7::jsonb,
           tai_khoan_ngan_hang = $8::jsonb
       where id = $1::uuid`,
      [
        id,
        input.templateId,
        blank(input.opsNote),
        input.quoteStatus,
        input.contractStatus,
        JSON.stringify(input.orders),
        JSON.stringify(input.notes),
        JSON.stringify(input.bank),
      ],
    );
    if (!updated.rowCount) return "missing" as const;
    return (await this.findQuote(lane, desk, id)) ?? "missing";
  }

  async updateQuoteOutcome(
    lane: CrmLane,
    desk: QuoteDesk,
    id: string,
    input: UpdateQuoteOutcomeInput,
  ): Promise<QuoteRecord | "missing" | "locked"> {
    const table = quoteTables[lane][desk];
    const updated = await this.query(
      `update ${table}
       set ly_do_khong_chot = $2
       where id = $1::uuid and trang_thai_hop_dong = 'CHUA_TAO'::crm.trang_thai_hop_dong_bao_gia`,
      [id, blank(input.nonCloseReason)],
    );
    if (!updated.rowCount) {
      const current = await this.query(
        `select 1 from ${table} where id = $1::uuid`,
        [id],
      );
      return current.rowCount ? "locked" : "missing";
    }
    return (await this.findQuote(lane, desk, id)) ?? "missing";
  }

  async sendQuote(lane: CrmLane, desk: QuoteDesk, id: string, input: UpdateQuoteInput) {
    if (desk === "logistics" && await this.sharedLogistics(lane, id)) return this.sendSharedLogistics(lane, id, input);
    const quote = await this.findQuote(lane, desk, id);
    if (!quote) return "missing" as const;
    if (input.orders.length === 0) return "empty" as const;
    const selected = input.orders.find((order) => order.selected);
    if (!selected) return "selection" as const;
    if (input.templateId) {
      const template = await this.query(
        `select 1 from crm.mau_bao_gia where id = $1::uuid and ban = $2::crm.ban_bao_gia`,
        [input.templateId, banOf(desk)],
      );
      if (!template.rowCount) return "template" as const;
    }
    const next = quote.quoteStatus === "CHUA_CO_BAO_GIA_LAI" || quote.quoteStatus === "DA_CO_BAO_GIA_LAI"
      ? "DA_CO_BAO_GIA_LAI"
      : "DA_CO_BAO_GIA";
    const sent: SentQuote = {
      sentAt: new Date().toISOString(),
      order: selected,
      notes: input.notes,
      bank: input.bank,
    };
    const handoff = desk === "sourcing" && isCombinedSourcing(quote);
    // Gửi báo giá Sourcing cũng chuyển sang Logistics: mẫu được chọn phải có thông tin đơn hàng.
    if (handoff && !orderHasContent(selected)) return "empty" as const;
    const handoffSheet = handoffSheetOf([logisticsOrderFromSourcing(selected)]);
    const updated = await this.query(
      `update ${quoteTables[lane][desk]}
       set ma_mau = $2::uuid,
           ghi_chu_vh = $3,
           trang_thai_bao_gia = $4::crm.trang_thai_bao_gia,
           trang_thai_hop_dong = $5::crm.trang_thai_hop_dong_bao_gia,
           chi_tiet_don_hang = $6::jsonb,
           ghi_chu = $7::jsonb,
           tai_khoan_ngan_hang = $8::jsonb,
           ban_da_gui = $9::jsonb
           ${handoff ? `, bao_gia_logistics = ${mergeHandoffSql("$10")}` : ""}
       where id = $1::uuid`,
      [
        id,
        input.templateId,
        blank(input.opsNote),
        next,
        input.contractStatus,
        JSON.stringify(input.orders),
        JSON.stringify(input.notes),
        JSON.stringify(input.bank),
        JSON.stringify(sent),
        ...(handoff ? [JSON.stringify(handoffSheet)] : []),
      ],
    );
    if (!updated.rowCount) return "missing" as const;
    return (await this.findQuote(lane, desk, id)) ?? "missing";
  }

  async returnQuote(lane: CrmLane, desk: QuoteDesk, id: string) {
    if (desk === "logistics" && await this.sharedLogistics(lane, id)) return this.returnSharedLogistics(lane, id);
    const quote = await this.findQuote(lane, desk, id);
    if (!quote) return "missing" as const;
    if (quote.contractStatus === "DA_TAO") return "contract" as const;
    if (quote.quoteStatus !== "DA_CO_BAO_GIA" && quote.quoteStatus !== "DA_CO_BAO_GIA_LAI") return "state" as const;
    await this.query(
      `update ${quoteTables[lane][desk]}
       set trang_thai_bao_gia = 'CHUA_CO_BAO_GIA_LAI'::crm.trang_thai_bao_gia
       where id = $1::uuid`,
      [id],
    );
    return (await this.findQuote(lane, desk, id)) ?? "missing";
  }

  async listQuoteTemplates(desk: QuoteDesk): Promise<QuoteTemplateRecord[]> {
    const result = await this.query<TemplateRow>(
      `select id::text as id, ten as name, noi_dung as content, tao_luc as created_at
       from crm.mau_bao_gia
       where ban = $1::crm.ban_bao_gia
       order by tao_luc desc`,
      [banOf(desk)],
    );
    return result.rows.map(toTemplate);
  }

  async createQuoteTemplate(desk: QuoteDesk, input: QuoteTemplateInput) {
    const name = input.name.trim();
    const duplicate = await this.query(
      `select 1 from crm.mau_bao_gia where ban = $1::crm.ban_bao_gia and ten = $2`,
      [banOf(desk), name],
    );
    if (duplicate.rowCount) return "duplicate" as const;
    const result = await this.query<TemplateRow>(
      `insert into crm.mau_bao_gia (ten, noi_dung, ban)
       values ($1, $2, $3::crm.ban_bao_gia)
       returning id::text as id, ten as name, noi_dung as content, tao_luc as created_at`,
      [name, blank(input.content), banOf(desk)],
    );
    const row = result.rows[0];
    if (!row) return "duplicate" as const;
    return toTemplate(row);
  }

  async updateQuoteTemplate(desk: QuoteDesk, id: string, input: QuoteTemplateInput) {
    const name = input.name.trim();
    const duplicate = await this.query(
      `select 1 from crm.mau_bao_gia
       where ban = $1::crm.ban_bao_gia and ten = $2 and id <> $3::uuid`,
      [banOf(desk), name, id],
    );
    if (duplicate.rowCount) return "duplicate" as const;
    const result = await this.query<TemplateRow>(
      `update crm.mau_bao_gia
       set ten = $2, noi_dung = $3
       where id = $1::uuid and ban = $4::crm.ban_bao_gia
       returning id::text as id, ten as name, noi_dung as content, tao_luc as created_at`,
      [id, name, blank(input.content), banOf(desk)],
    );
    const row = result.rows[0];
    return row ? toTemplate(row) : "missing" as const;
  }

  async deleteQuoteTemplate(desk: QuoteDesk, id: string) {
    const used = await this.query<{ used: boolean }>(
      `select (
         exists(select 1 from crm.bao_gia_sourcing_viet_nam where ma_mau = $1::uuid)
         or exists(select 1 from crm.bao_gia_sourcing_global where ma_mau = $1::uuid)
         or exists(select 1 from crm.bao_gia_logistics_viet_nam where ma_mau = $1::uuid)
         or exists(select 1 from crm.bao_gia_logistics_global where ma_mau = $1::uuid)
         or exists(select 1 from crm.bao_gia_sourcing_viet_nam where bao_gia_logistics->>'templateId' = $1::text)
         or exists(select 1 from crm.bao_gia_sourcing_global where bao_gia_logistics->>'templateId' = $1::text)
       ) as used`,
      [id],
    );
    if (used.rows[0]?.used) return "used" as const;
    const removed = await this.query(
      `delete from crm.mau_bao_gia where id = $1::uuid and ban = $2::crm.ban_bao_gia`,
      [id, banOf(desk)],
    );
    return removed.rowCount ? "ok" as const : "missing" as const;
  }

  async listContracts(lane: CrmLane, sentOnly: boolean, view: ContractView, search: ContractListSearch): Promise<ContractRecord[]> {
    const compiled = contractSearch(view, search).build(3);
    const result = await this.query<ContractRow>(
      `${contractSelect()} where h.tuyen = $1 and ($2::boolean = false or h.gui_ke_toan_luc is not null)
       ${compiled.sql}
       order by h.tao_luc desc limit 200`,
      [lane, sentOnly, ...compiled.values],
    );
    const quotes = new Map<string, QuoteRecord | null>();
    const contracts: ContractRecord[] = [];
    for (const row of result.rows) contracts.push(await this.withMainTotal(lane, projectContract(row, view), quotes));
    return contracts;
  }

  async createContract(lane: CrmLane, quoteId: string, input: CreateContractInput) {
    const tables = quoteTables[lane];
    const found = await this.query<{ code: string }>(
      `select ma_hien_thi as code from ${tables.sourcing} where id = $1::uuid
       union all
       select ma_hien_thi as code from ${tables.logistics} where id = $1::uuid`,
      [quoteId],
    );
    const quote = found.rows[0];
    if (!quote) return "missing" as const;
    const category = await this.query<{ industry: IndustryCategory | null }>(
      `select m.nganh_hang as industry
       from ${tables.sourcing} q
       join ${tables.potential} p on p.id = q.ma_khach_hang_tiem_nang
       left join ${tables.message} m on m.id = p.ma_tin_nhan
       where q.id = $1::uuid
       union all
       select m.nganh_hang as industry
       from ${tables.logistics} q
       join ${tables.potential} p on p.id = q.ma_khach_hang_tiem_nang
       left join ${tables.message} m on m.id = p.ma_tin_nhan
       where q.id = $1::uuid
       limit 1`,
      [quoteId],
    );
    const industry = category.rows[0]?.industry ?? null;
    const source = await this.findQuote(lane, "sourcing", quoteId) ?? await this.findQuote(lane, "logistics", quoteId);
    const pureLogistics = source?.customerKind === "LOGISTICS";
    const order = source?.sentQuote?.order ?? source?.orders.find((item) => item.selected) ?? source?.orders[0];
    const product = pureLogistics ? [] : productAmounts(order);
    const productValue = pureLogistics ? 0 : product.find((item) => item.currency === input.currency)?.amount ?? input.productValue;
    const productLines = product.length > 0 ? product : [{ currency: input.currency, amount: productValue }];
    const sheet = pureLogistics ? source : source?.logisticsSheet && { ...source.logisticsSheet, shippingMode: source.shippingMode, logisticsClass: source.logisticsClass };
    const linkedShipping = sheet ? shippingAmount(sheet) : null;
    if (sheet && !linkedShipping) throw new AppError(400, "RULE", "Chi phí vận chuyển trên báo giá chưa hợp lệ");
    const shippingCurrency = linkedShipping?.currency ?? input.currency;
    const shippingCost = linkedShipping?.amount ?? input.shippingCost;
    // Cước khác loại tiền chính thì quy đổi theo tỷ giá trên báo giá để tổng giá trị là một loại tiền chính.
    const shippingConverted = shippingCurrency === input.currency ? null : convertedShipping(source, input.currency);
    const shippingInMain = shippingCurrency === input.currency ? shippingCost : shippingConverted;
    const totalValue = shippingInMain == null ? productValue : Math.round((productValue + shippingInMain) * 100) / 100;
    input = { ...input, productValue, shippingCost, totalValue };
    if (input.paidAmount > input.totalValue) throw new AppError(400, "RULE", "Thanh toán vượt tổng hợp đồng");
    // Tỷ giá quy đổi VND lấy theo báo giá; Sale bổ sung/sửa ở hợp đồng nếu còn thiếu.
    const vndRates = quoteVndRates(pureLogistics ? null : source, sheet || null);
    const amounts = {
      product: productLines,
      shipping: [{ currency: shippingCurrency, amount: shippingCost, ...(shippingConverted != null ? { converted: shippingConverted } : {}) }],
      ...(Object.keys(vndRates).length > 0 ? { vndRates } : {}),
    };
    await this.query(
      `insert into crm.hop_dong (
         tuyen, ma_bao_gia, ma_bao_gia_hien_thi, ten_khach_hang, nhan_vien_ban, van_chuyen_den,
         san_pham, so_luong, gia_tri_san_pham, chi_phi_van_chuyen, tong_gia_tri, so_tien_thanh_toan, ngay_ky, loai_tien, nganh_hang,
         loai_tien_van_chuyen, khoan_tien
       ) values (
         $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14, $15, $16, $17::jsonb
       ) on conflict (tuyen, ma_bao_gia) do nothing`,
      [
        lane,
        quoteId,
        quote.code,
        input.customerName.trim(),
        blank(input.saleName),
        blank(input.shipTo),
        blank(input.product),
        input.quantity,
        input.productValue,
        input.shippingCost,
        input.totalValue,
        input.paidAmount,
        input.signedOn || null,
        input.currency,
        industry,
        shippingCurrency,
        JSON.stringify(amounts),
      ],
    );
    if (input.paidAmount > 0) {
      await this.query(
        `insert into crm.hop_dong_dong_thanh_toan (ma_hop_dong, so_tien, thu_tu, loai_tien)
         select id, $3, 1, $4 from crm.hop_dong
         where tuyen = $1 and ma_bao_gia = $2::uuid
           and not exists (
             select 1 from crm.hop_dong_dong_thanh_toan d where d.ma_hop_dong = crm.hop_dong.id
           )`,
        [lane, quoteId, input.paidAmount, input.currency],
      );
    }
    await this.query(
      `update ${tables.sourcing} set
         trang_thai_hop_dong = 'DA_TAO'::crm.trang_thai_hop_dong_bao_gia,
         bao_gia_logistics = case
           when bao_gia_logistics is null then null
           else jsonb_set(bao_gia_logistics, '{contractStatus}', '"DA_TAO"')
         end
       where id = $1::uuid`,
      [quoteId],
    );
    await this.query(
      `update ${tables.logistics} set trang_thai_hop_dong = 'DA_TAO'::crm.trang_thai_hop_dong_bao_gia where id = $1::uuid`,
      [quoteId],
    );
    await this.query(
      `update crm.hop_dong set ban_gui_van_hanh = ${commercialSnapshotSql}
       where tuyen = $1 and ma_bao_gia = $2::uuid and ban_gui_van_hanh is null`,
      [lane, quoteId],
    );
    const contract = await this.findContract(lane, quoteId, "sale");
    return contract ?? "missing";
  }

  async updateOpsContract(lane: CrmLane, id: string, input: OpsContractInput) {
    const updated = await this.query(
      `update crm.hop_dong set
         trang_thai_van_hanh = $3,
         tracking = $4,
         ghi_chu_1 = $5,
         ghi_chu_2 = $6,
         ngay_nhap_kho_tq = $7::date,
         ngay_xuat_container = $8::date,
         ngay_cap_cang = $9::date,
         ngay_giao_du_kien = $10::date
       where id = $1::uuid and tuyen = $2`,
      [
        id,
        lane,
        blank(input.opsStatus),
        blank(input.tracking),
        blank(input.note1),
        blank(input.note2),
        input.chinaWarehouseOn || null,
        input.containerOn || null,
        input.arrivalOn || null,
        input.deliveryOn || null,
      ],
    );
    if (!updated.rowCount) return "missing" as const;
    return (await this.findContractById(lane, id, "ops")) ?? "missing";
  }

  async updateAccountingContract(lane: CrmLane, id: string, input: AccountingContractInput) {
    const current = await this.findContractById(lane, id, "accounting");
    if (!current) return "missing" as const;
    if (!current.sentToAccountingAt) return "pending" as const;
    // Xác nhận bằng loại tiền khác hợp đồng cần tỷ giá của lần đó (dòng cũ giữ nguyên số tiền và loại tiền thì không bắt nhập lại).
    if (input.confirmations.some((line, index) => line.amount > 0 && line.currency && line.currency !== current.currency && !line.exchangeRate &&
      (current.confirmations[index]?.amount !== line.amount || current.confirmations[index]?.currency !== line.currency))) {
      throw new AppError(400, "VALIDATION", "Nhập tỷ giá cho khoản xác nhận khác loại tiền hợp đồng");
    }
    const confirmations = input.confirmations.filter(
      (line) => line.amount > 0 || line.note || line.images.length > 0,
    ).map((line) => ({ ...line, currency: line.currency ?? current.currency }));
    const confirmedAmount = sumByCurrency([paymentsInMain(confirmations, current.amounts, current.currency)])
      .find((line) => line.currency === current.currency)?.amount ?? 0;
    const updated = await this.query(
      `update crm.hop_dong set
         so_tien_xac_nhan = $3,
         trang_thai_ke_toan = $4::crm.trang_thai_xac_nhan_ke_toan
       where id = $1::uuid and tuyen = $2`,
      [id, lane, confirmedAmount, input.accountingStatus],
    );
    if (!updated.rowCount) return "missing" as const;
    await this.query(`delete from crm.hop_dong_dong_xac_nhan where ma_hop_dong = $1::uuid`, [id]);
    const flatImages: string[] = [];
    for (const [index, line] of confirmations.entries()) {
      await this.query(
        `insert into crm.hop_dong_dong_xac_nhan (ma_hop_dong, so_tien, ghi_chu, thu_tu, anh, loai_tien, ty_gia)
         values ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7)`,
        [id, line.amount, blank(line.note), index + 1, JSON.stringify(line.images), line.currency, line.exchangeRate],
      );
      flatImages.push(...line.images);
    }
    // Giữ bảng ảnh hợp đồng đồng bộ cho snapshot / danh sách cũ.
    await this.query(`delete from crm.hop_dong_anh_bill where ma_hop_dong = $1::uuid`, [id]);
    for (const [index, image] of flatImages.entries()) {
      await this.query(
        `insert into crm.hop_dong_anh_bill (ma_hop_dong, duong_dan, thu_tu) values ($1::uuid, $2, $3)`,
        [id, image, index + 1],
      );
    }
    return (await this.findContractById(lane, id, "accounting")) ?? "missing";
  }

  async updateCommercialContract(lane: CrmLane, id: string, input: SaleContractPaymentInput) {
    const current = await this.findContractById(lane, id, "sale");
    if (!current) return "missing" as const;
    // Tỷ giá VND của hợp đồng: Sale có thể bổ sung/sửa; VND luôn bằng 1 nên không lưu.
    const vndRates = { ...(current.amounts.vndRates ?? {}), ...(input.vndRates ?? {}) };
    delete vndRates.VND;
    const amounts = { ...current.amounts, vndRates };
    // Khách được trả bằng bất kỳ loại tiền nào. Khác loại tiền hợp đồng thì cần tỷ giá của lần đó để quy về tiền hợp đồng
    // (dòng cũ giữ nguyên số tiền và loại tiền thì không bắt nhập lại).
    if (input.payments.some((line, index) => line.amount > 0 && line.currency !== current.currency && !line.exchangeRate &&
      (current.payments[index]?.amount !== line.amount || current.payments[index]?.currency !== line.currency))) {
      throw new AppError(400, "VALIDATION", "Nhập tỷ giá cho khoản thanh toán khác loại tiền hợp đồng");
    }
    const payments = input.payments.filter(
      (line) => line.amount > 0 || line.paidOn || line.note || line.images.length > 0,
    );
    // So sánh trên loại tiền hợp đồng sau khi quy theo tỷ giá từng lần; cho phép lệch làm tròn 0,01.
    const totals = totalsInMain(amounts, current.currency);
    const paidGroups = sumByCurrency([paymentsInMain(payments, amounts, current.currency)]);
    if (paidGroups.some((group) => group.amount > (totals.find((item) => item.currency === group.currency)?.amount ?? 0) + 0.01)) return "invalid" as const;
    const paidAmount = paidGroups.find((group) => group.currency === current.currency)?.amount ?? 0;
    const updated = await this.query(
      `update crm.hop_dong set so_tien_thanh_toan = $3,
         khoan_tien = coalesce(khoan_tien, '{}'::jsonb) || jsonb_build_object('vndRates', $4::jsonb)
       where id = $1::uuid and tuyen = $2`,
      [id, lane, paidAmount, JSON.stringify(vndRates)],
    );
    if (!updated.rowCount) return "missing" as const;
    await this.query(`delete from crm.hop_dong_dong_thanh_toan where ma_hop_dong = $1::uuid`, [id]);
    const flatImages: string[] = [];
    for (const [index, line] of payments.entries()) {
      await this.query(
        `insert into crm.hop_dong_dong_thanh_toan (ma_hop_dong, so_tien, ngay_chuyen, ghi_chu, thu_tu, anh_bill, loai_tien, ty_gia)
         values ($1::uuid, $2, $3::date, $4, $5, $6::jsonb, $7, $8)`,
        [id, line.amount, line.paidOn || null, blank(line.note), index + 1, JSON.stringify(line.images), line.currency || current.currency, line.exchangeRate],
      );
      flatImages.push(...line.images);
    }
    // Giữ bảng ảnh hợp đồng đồng bộ (danh sách / snapshot kế toán đọc từ đây).
    await this.query(`delete from crm.hop_dong_anh_bill where ma_hop_dong = $1::uuid`, [id]);
    for (const [index, image] of flatImages.entries()) {
      await this.query(
        `insert into crm.hop_dong_anh_bill (ma_hop_dong, duong_dan, thu_tu) values ($1::uuid, $2, $3)`,
        [id, image, index + 1],
      );
    }
    return (await this.findContractById(lane, id, "sale")) ?? "missing";
  }

  async resendContract(lane: CrmLane, id: string, target: "ops" | "accounting" | "parties") {
    const view: ContractView = target === "ops" ? "sale" : target === "accounting" ? "ops" : "accounting";
    const assignment = target === "ops"
      ? `gui_van_hanh_luc = now(), ban_gui_van_hanh = ${commercialSnapshotSql}`
      : target === "accounting"
        ? `gui_ke_toan_luc = now(), ban_gui_ke_toan = (${opsSnapshotSql}) || ${commercialSnapshotSql}`
        : `gui_xac_nhan_luc = now(), ban_gui_xac_nhan = ${accountingSnapshotSql}`;
    const pendingGuard = target === "parties" ? "and gui_ke_toan_luc is not null" : "";
    const updated = await this.query(
      `update crm.hop_dong set ${assignment}
       where id = $1::uuid and tuyen = $2 ${pendingGuard}`,
      [id, lane],
    );
    if (updated.rowCount) return (await this.findContractById(lane, id, view)) ?? "missing";
    const current = await this.findContractById(lane, id, view);
    if (!current) return "missing" as const;
    return "pending" as const;
  }

  async deleteContract(lane: CrmLane, id: string) {
    const current = await this.findContractById(lane, id, "sale");
    if (!current) return "missing" as const;
    const tables = quoteTables[lane];
    await this.query(
      `update ${tables.sourcing} set
         trang_thai_hop_dong = 'CHUA_TAO'::crm.trang_thai_hop_dong_bao_gia,
         bao_gia_logistics = case
           when bao_gia_logistics is null then null
           else jsonb_set(bao_gia_logistics, '{contractStatus}', '"CHUA_TAO"')
         end
       where id = $1::uuid`,
      [current.quoteId],
    );
    await this.query(
      `update ${tables.logistics} set trang_thai_hop_dong = 'CHUA_TAO'::crm.trang_thai_hop_dong_bao_gia where id = $1::uuid`,
      [current.quoteId],
    );
    const removed = await this.query(`delete from crm.hop_dong where id = $1::uuid and tuyen = $2`, [id, lane]);
    return removed.rowCount ? "ok" as const : "missing" as const;
  }

  private async findContract(lane: CrmLane, quoteId: string, view: ContractView): Promise<ContractRecord | null> {
    const result = await this.query<ContractRow>(
      `${contractSelect()} where h.tuyen = $1 and h.ma_bao_gia = $2::uuid`,
      [lane, quoteId],
    );
    return result.rows[0] ? this.withMainTotal(lane, projectContract(result.rows[0], view)) : null;
  }

  /**
   * Tổng giá trị quy ra loại tiền chính. Hợp đồng cũ chưa lưu số quy đổi của cước thì tính lại từ tỷ giá trên báo giá.
   * Khi thiếu tỷ giá, giữ nguyên số đã lưu và tổng vẫn tách theo từng loại tiền.
   */
  private async withMainTotal(lane: CrmLane, contract: ContractRecord, quotes = new Map<string, QuoteRecord | null>()): Promise<ContractRecord> {
    const main = contract.currency;
    let shipping = contract.amounts.shipping;
    // Hợp đồng cũ chưa lưu tỷ giá VND: lấy theo báo giá gốc để vẫn quy VND được (Sale sửa được ở tab Thanh toán).
    const currencies = [...contract.amounts.product, ...shipping].map((line) => line.currency);
    let vndRates = contract.amounts.vndRates;
    if (currencies.some((code) => code !== "VND" && !vndRates?.[code])) {
      if (!quotes.has(contract.quoteId)) quotes.set(contract.quoteId, await this.findQuote(lane, "sourcing", contract.quoteId) ?? await this.findQuote(lane, "logistics", contract.quoteId));
      const source = quotes.get(contract.quoteId) ?? null;
      if (source) {
        const pureLogistics = source.customerKind === "LOGISTICS";
        const sheet = pureLogistics ? source : source.logisticsSheet && { ...source.logisticsSheet, shippingMode: source.shippingMode, logisticsClass: source.logisticsClass };
        vndRates = { ...quoteVndRates(pureLogistics ? null : source, sheet || null), ...(vndRates ?? {}) };
      }
    }
    if (shipping.some((line) => line.currency !== main && line.converted == null)) {
      if (!quotes.has(contract.quoteId)) quotes.set(contract.quoteId, await this.findQuote(lane, "sourcing", contract.quoteId));
      const converted = convertedShipping(quotes.get(contract.quoteId) ?? null, main);
      if (converted != null && shipping.length === 1) shipping = [{ ...shipping[0], converted }];
    }
    const amounts = { ...contract.amounts, shipping, ...(vndRates && Object.keys(vndRates).length > 0 ? { vndRates } : {}) };
    const totals = totalsInMain(amounts, main);
    if (totals.length !== 1 || totals[0].currency !== main) return { ...contract, amounts };
    const totalValue = totals[0].amount;
    return { ...contract, amounts, totalValue, balance: Math.round((totalValue - contract.paidAmount) * 100) / 100 };
  }

  private async findContractById(lane: CrmLane, id: string, view: ContractView): Promise<ContractRecord | null> {
    const result = await this.query<ContractRow>(
      `${contractSelect()} where h.tuyen = $1 and h.id = $2::uuid`,
      [lane, id],
    );
    return result.rows[0] ? this.withMainTotal(lane, projectContract(result.rows[0], view)) : null;
  }

  async findQuote(lane: CrmLane, desk: QuoteDesk, id: string): Promise<QuoteRecord | null> {
    const tables = quoteTables[lane];
    if (desk === "logistics") {
      const own = await this.query<QuoteRow>(
        `${quoteSelect(tables.logistics, tables.potential, tables.message, null, false)} and q.id = $1::uuid`,
        [id],
      );
      if (own.rows[0]) return toQuote(own.rows[0]);
      const shared = await this.query<QuoteRow>(
        `${quoteSelect(tables.sourcing, tables.potential, tables.message, null, true)} and q.id = $1::uuid and ${COMBINED_HANDED_OFF_SQL}`,
        [id],
      );
      return shared.rows[0] ? toLogisticsQuote(shared.rows[0]) : null;
    }
    const result = await this.query<QuoteRow>(
      `${quoteSelect(tables.sourcing, tables.potential, tables.message, tables.logistics, true)} and q.id = $1::uuid`,
      [id],
    );
    return result.rows[0] ? toQuote(result.rows[0]) : null;
  }

  async findQuoteByPotential(lane: CrmLane, desk: QuoteDesk, potentialId: string): Promise<QuoteRecord | null> {
    const tables = quoteTables[lane];
    if (desk === "logistics") {
      const own = await this.query<QuoteRow>(
        `${quoteSelect(tables.logistics, tables.potential, tables.message, null, false)} and q.ma_khach_hang_tiem_nang = $1::uuid`,
        [potentialId],
      );
      if (own.rows[0]) return toQuote(own.rows[0]);
      const shared = await this.query<QuoteRow>(
        `${quoteSelect(tables.sourcing, tables.potential, tables.message, null, true)} and q.ma_khach_hang_tiem_nang = $1::uuid and ${COMBINED_HANDED_OFF_SQL}`,
        [potentialId],
      );
      return shared.rows[0] ? toLogisticsQuote(shared.rows[0]) : null;
    }
    const result = await this.query<QuoteRow>(
      `${quoteSelect(tables.sourcing, tables.potential, tables.message, tables.logistics, true)} and q.ma_khach_hang_tiem_nang = $1::uuid`,
      [potentialId],
    );
    return result.rows[0] ? toQuote(result.rows[0]) : null;
  }

  private async sharedLogistics(lane: CrmLane, id: string): Promise<boolean> {
    const tables = quoteTables[lane];
    const own = await this.query(`select 1 from ${tables.logistics} where id = $1::uuid`, [id]);
    if (own.rowCount) return false;
    const shared = await this.query(
      `select 1 from ${tables.sourcing} q
       join ${tables.potential} l on l.id = q.ma_khach_hang_tiem_nang
       where q.id = $1::uuid and (l.nhom_khach::text = 'SOURCING' and l.luong_bao_gia = 'COMBINED') and l.xoa_luc is null`,
      [id],
    );
    return Boolean(shared.rowCount);
  }

  private async saveSharedLogistics(lane: CrmLane, id: string, sheet: ReturnType<typeof logisticsPayload>) {
    const updated = await this.query(
      `update ${quoteTables[lane].sourcing}
       set bao_gia_logistics = $2::jsonb || jsonb_build_object('handoffAt', bao_gia_logistics->'handoffAt')
       where id = $1::uuid`,
      [id, JSON.stringify(sheet)],
    );
    if (!updated.rowCount) return "missing" as const;
    return (await this.findQuote(lane, "logistics", id)) ?? "missing";
  }

  private async updateSharedLogistics(lane: CrmLane, id: string, input: UpdateQuoteInput) {
    if (input.templateId) {
      const template = await this.query(
        `select 1 from crm.mau_bao_gia where id = $1::uuid and ban = 'LOGISTICS'::crm.ban_bao_gia`,
        [input.templateId],
      );
      if (!template.rowCount) return "template" as const;
    }
    const current = await this.findQuote(lane, "logistics", id);
    if (!current) return "missing" as const;
    return this.saveSharedLogistics(lane, id, logisticsPayload(input, input.quoteStatus, current.sentQuote));
  }

  private async sendSharedLogistics(lane: CrmLane, id: string, input: UpdateQuoteInput) {
    const quote = await this.findQuote(lane, "logistics", id);
    if (!quote) return "missing" as const;
    if (input.orders.length === 0) return "empty" as const;
    const selected = input.orders.find((order) => order.selected);
    if (!selected) return "selection" as const;
    if (input.templateId) {
      const template = await this.query(
        `select 1 from crm.mau_bao_gia where id = $1::uuid and ban = 'LOGISTICS'::crm.ban_bao_gia`,
        [input.templateId],
      );
      if (!template.rowCount) return "template" as const;
    }
    const next = quote.quoteStatus === "CHUA_CO_BAO_GIA_LAI" || quote.quoteStatus === "DA_CO_BAO_GIA_LAI"
      ? "DA_CO_BAO_GIA_LAI"
      : "DA_CO_BAO_GIA";
    const sent: SentQuote = {
      sentAt: new Date().toISOString(),
      order: selected,
      notes: input.notes,
      bank: input.bank,
    };
    return this.saveSharedLogistics(lane, id, logisticsPayload(input, next, sent));
  }

  private async returnSharedLogistics(lane: CrmLane, id: string) {
    const quote = await this.findQuote(lane, "logistics", id);
    if (!quote) return "missing" as const;
    if (quote.contractStatus === "DA_TAO") return "contract" as const;
    if (quote.quoteStatus !== "DA_CO_BAO_GIA" && quote.quoteStatus !== "DA_CO_BAO_GIA_LAI") return "state" as const;
    const updated = await this.query(
      `update ${quoteTables[lane].sourcing}
       set bao_gia_logistics = jsonb_set(bao_gia_logistics, '{quoteStatus}', '"CHUA_CO_BAO_GIA_LAI"')
       where id = $1::uuid`,
      [id],
    );
    if (!updated.rowCount) return "missing" as const;
    return (await this.findQuote(lane, "logistics", id)) ?? "missing";
  }

  private async findMessage(lane: CrmLane, id: string): Promise<MessageRecord | null> {
    const { message: messageTable, potential: potentialTable } = laneTables[lane];
    const result = await this.query<MessageRow>(`${messageSelect(messageTable, potentialTable)} where m.id = $1::uuid`, [id]);
    const row = result.rows[0];
    return row ? toMessage(row) : null;
  }

  private async query<T extends pg.QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<pg.QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (cause) {
      raise(cause);
    }
  }

  private async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (cause) {
      await client.query("rollback");
      raise(cause);
    } finally {
      client.release();
    }
  }
}
