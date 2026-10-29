import { z } from "zod";

export const crmLaneSchema = z.enum(["vn", "global"]);
export type CrmLane = z.infer<typeof crmLaneSchema>;

export const leadSourceSchema = z.enum(["ADS", "GG", "OG", "AF", "REFERRAL", "OUTBOUND"]);
export const leadBrandSchema = z.enum([
  "SPEEGO_NAIL",
  "SPEEGO_US",
  "SPEEGO_CA",
  "SPEEGO_AU",
  "SPEEGO_BUSINESS",
  "SPEEGO_RETAIL",
  "SOURCING",
  "LOGISTICS",
]);
export const messageDemandSchema = z.enum(["SHIPPING", "SOURCING"]);
export const messageClassificationSchema = z.enum(["HOT", "WARM", "COLD", "DEAD"]);
export const customerTypeSchema = z.enum(["INDIVIDUAL", "PRINCIPAL", "ENTERPRISE"]);
export const customerKindSchema = z.enum(["SOURCING", "LOGISTICS", "SOURCING_LOGISTICS"]);
export const potentialStatusSchema = z.enum(["POTENTIAL", "CLOSING", "DEPOSITED", "NOT_ORDERED"]);
export const leadClassificationSchema = z.enum(["LCL", "FCL"]);
export const careChannelSchema = z.enum(["FACEBOOK", "ZALO", "WHATSAPP", "VIBER"]);

const text = (max: number) => z.string().trim().max(max);

function contact(value: { phone: string; email: string }, ctx: z.RefinementCtx) {
  if (!value.phone && !value.email) {
    ctx.addIssue({ code: "custom", message: "Cần số điện thoại hoặc email", path: ["phone"] });
  }
  if (value.email && !z.string().email().safeParse(value.email).success) {
    ctx.addIssue({ code: "custom", message: "Email không đúng định dạng", path: ["email"] });
  }
}

const receivedOn = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không đúng định dạng")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00+07:00`)), "Ngày không hợp lệ");

const messageFields = {
  customerName: z.string().trim().min(1, "Nhập tên khách").max(160),
  phone: text(30),
  email: text(160),
  goods: text(500),
  note: text(2000),
  demand: messageDemandSchema.optional(),
  customerType: customerTypeSchema.optional(),
  receivedOn: receivedOn.optional(),
  market: text(160),
  classification: messageClassificationSchema.optional(),
  saleName: text(160),
  painPoint: text(2000),
  linkMess: text(500),
};

export const createMessageSchema = z.object(messageFields).superRefine(contact);

export const updateMessageSchema = z.object(messageFields).superRefine(contact);

export const updatePotentialSchema = z
  .object({
    fullName: z.string().trim().min(1, "Nhập tên khách").max(160),
    companyName: text(160),
    phone: text(30),
    email: text(160),
    productInterest: text(500),
    quantityNote: text(500),
    address: text(300),
    saleNote: text(2000),
    potential: potentialStatusSchema,
    customerKind: customerKindSchema.optional(),
    customerType: customerTypeSchema.optional(),
    brand: leadBrandSchema.optional(),
    careChannel: careChannelSchema.optional(),
    classification: leadClassificationSchema.optional(),
    packSpec: text(2000).optional(),
    weightKg: z.number().positive("Trọng lượng phải lớn hơn 0").max(999999999).optional(),
    logisticsClass: leadClassificationSchema.optional(),
    shipFromAddress: text(2000).optional(),
    shipToAddress: text(2000).optional(),
  })
  .superRefine(contact);

export const quoteDeskSchema = z.enum(["sourcing", "logistics"]);
export const quoteStatusSchema = z.enum([
  "CHUA_CO_BAO_GIA",
  "DA_CO_BAO_GIA",
  "CHUA_CO_BAO_GIA_LAI",
  "DA_CO_BAO_GIA_LAI",
]);
export const contractQuoteStatusSchema = z.enum(["CHUA_TAO", "DA_TAO"]);

const uuidText = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "Mã không hợp lệ",
);

const amount = z.number().min(0, "Số không được âm").max(1_000_000_000).nullable();

const dim = z.number().min(0, "Số không được âm").max(100_000);

export const quotePackageSchema = z.object({
  count: z.number().int().min(1).max(10_000),
  lengthCm: dim,
  widthCm: dim,
  heightCm: dim,
  actualKg: dim,
});

export const quoteAttrSchema = z.object({ key: text(80), value: text(300) });

export const quoteLineSchema = z.object({
  stt: text(20),
  image: z.string().max(100_000).refine(
    (value) => value === "" || value.startsWith("data:image/") || /^https:\/\//.test(value),
    "Ảnh không hợp lệ",
  ),
  quantity: amount,
  pricePerSet: amount,
  lineTotal: amount,
  weightKg: amount,
  spec: text(4000),
  note: text(4000),
  /** Đơn vị tính: set, ghế, kg, cbm, lô... */
  unit: text(20).default("set"),
  /** Cách tính giá: theo đơn vị (SL × giá), theo kg, theo CBM hoặc trọn gói */
  basis: z.enum(["unit", "kg", "cbm", "lump"]).default("unit"),
  cbm: amount.default(null),
  /** Quy cách đóng gói. Có kiện thì CBM và cân tính cước được suy ra từ đây */
  packages: z.array(quotePackageSchema).max(20, "Tối đa 20 kiện mỗi dòng").default([]),
  /** Thuộc tính tự do: chất liệu, bảo hành, thời gian sản xuất... */
  attrs: z.array(quoteAttrSchema).max(20, "Tối đa 20 thuộc tính mỗi dòng").default([]),
});

const depositLine = text(300);

export const quoteNotesSchema = z.object({
  totalLabel: text(300),
  weightNote: text(500),
  validityNote: text(500),
  deposit: z.union([
    depositLine,
    z.array(depositLine).max(20, "Tối đa 20 dòng đặt cọc"),
  ]).transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
});

export const quoteBankSchema = z.object({
  title: text(200),
  accountName: text(200),
  accountNumber: text(80),
  routingNumber: text(80),
});

/** Nội tệ VND đứng đầu; còn lại là ngoại tệ báo giá cho khách quốc tế. */
export const quoteCurrencies = ["VND", "USD", "AUD", "EUR", "GBP", "CAD", "SGD", "CNY", "JPY"] as const;
export const quoteCurrencySchema = z.enum(quoteCurrencies);
export type QuoteCurrency = z.infer<typeof quoteCurrencySchema>;

export const quoteOrderSchema = z.object({
  id: uuidText,
  name: z.string().trim().min(1, "Nhập tên thông tin đơn hàng").max(160),
  selected: z.boolean(),
  currency: quoteCurrencySchema.default("VND"),
  /** Tỷ giá: số VND cho 1 đơn vị ngoại tệ, chỉ dùng khi currency khác VND (để hiện quy đổi) */
  rate: z.number().positive("Tỷ giá phải lớn hơn 0").max(1_000_000).nullable().default(null),
  lines: z.array(quoteLineSchema).max(40, "Tối đa 40 dòng hàng"),
});

export const updateQuoteSchema = z.object({
  templateId: uuidText.nullable(),
  opsNote: text(2000),
  quoteStatus: quoteStatusSchema,
  contractStatus: contractQuoteStatusSchema,
  orders: z.array(quoteOrderSchema).max(30, "Tối đa 30 mẫu đơn hàng"),
  notes: quoteNotesSchema,
  bank: quoteBankSchema,
}).superRefine((value, ctx) => {
  if (value.orders.filter((order) => order.selected).length > 1) {
    ctx.addIssue({ code: "custom", message: "Chỉ chọn một mẫu báo giá", path: ["orders"] });
  }
});

export const reassignQuoteSchema = z.object({
  potentialId: uuidText,
});

export const quoteTemplateSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên mẫu").max(160),
  content: text(8000),
});

const money = z.number().min(0, "Số không được âm").max(1_000_000_000);
const day = z.string().trim().regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Ngày không đúng định dạng");

export const accountingStatusSchema = z.enum([
  "DA_HOAN_THANH_COC",
  "DA_HOAN_THANH_THANH_TOAN",
  "CHUA_HOAN_THANH_COC",
  "CHUA_HOAN_THANH_THANH_TOAN",
]);

export const contractShipToOptions = [
  "Trung - CA",
  "Trung - US",
  "Trung - Úc",
  "VN - US",
  "VN - CA",
  "VN - ÚC",
  "Trung-TBN",
  "Business",
] as const;

export const contractShipToSchema = z.enum(contractShipToOptions);

export const createContractSchema = z.object({
  /** Loại tiền chung cho mọi số tiền của hợp đồng. Hợp đồng cũ mặc định USD */
  currency: quoteCurrencySchema.default("USD"),
  customerName: z.string().trim().min(1, "Nhập tên khách hàng").max(200),
  saleName: text(160),
  shipTo: z.union([z.literal(""), contractShipToSchema]),
  product: text(300),
  quantity: z.number().min(0).max(1_000_000_000).nullable(),
  productValue: money,
  shippingCost: money,
  totalValue: money,
  paidAmount: money,
  signedOn: day,
}).superRefine((value, ctx) => {
  if (value.paidAmount > value.totalValue) {
    ctx.addIssue({ code: "custom", message: "Số tiền thanh toán không được lớn hơn tổng giá trị", path: ["paidAmount"] });
  }
});

export const opsStatusOptions = [
  "Hợp đồng",
  "Đặt cọc",
  "Đang sản xuất",
  "Đang vận chuyển",
  "Hoàn thành",
  "Hàng mẫu",
  "Đợi check cọc",
  "Hủy đơn",
] as const;

/** Cột J = tổng HĐ, cột O = kế toán xác nhận số tiền (sheet Hợp đồng). */
export function contractPaymentFlags(input: {
  totalValue: number;
  confirmedAmount: number | null | undefined;
  deliveryOn: string | null | undefined;
  today?: string;
}) {
  const total = Number.isFinite(input.totalValue) ? input.totalValue : 0;
  const confirmed = input.confirmedAmount == null || !Number.isFinite(input.confirmedAmount)
    ? 0
    : input.confirmedAmount;
  const eligibleToShip = total > 0 && confirmed >= total * 0.5;
  // Sheet ghi nhầm "M >= 100% J"; công thức thật dùng O >= 100% J.
  const eligibleToDeliver = total > 0 && confirmed >= total;
  const deliveryOn = input.deliveryOn?.trim() || "";
  const today = (input.today ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  let urgePayment = false;
  if (deliveryOn && !eligibleToDeliver) {
    const delivery = Date.parse(`${deliveryOn}T00:00:00Z`);
    const now = Date.parse(`${today}T00:00:00Z`);
    if (Number.isFinite(delivery) && Number.isFinite(now)) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      urgePayment = now >= delivery - sevenDaysMs;
    }
  }
  return {
    eligibleToShip,
    eligibleToDeliver,
    urgePayment,
    urgePaymentLabel: urgePayment ? "Yêu cầu khách thanh toán đủ để nhận hàng" : "",
    eligibleToShipLabel: eligibleToShip ? "Đủ điều kiện đi hàng" : "",
    eligibleToDeliverLabel: eligibleToDeliver ? "Đủ điều kiện giao hàng" : "",
  };
}

export const opsStatusSchema = z.enum(opsStatusOptions);

export const opsContractSchema = z.object({
  opsStatus: z.union([z.literal(""), opsStatusSchema]),
  tracking: text(200),
  note1: text(2000),
  note2: text(2000),
  chinaWarehouseOn: day,
  containerOn: day,
  arrivalOn: day,
  deliveryOn: day,
  send: z.boolean().optional(),
});

export const accountingContractSchema = z.object({
  confirmedAmount: money,
  accountingStatus: accountingStatusSchema,
  images: z.array(z.string().max(100_000).refine(
    (value) => value.startsWith("data:image/"),
    "Ảnh không hợp lệ",
  )).max(10, "Tối đa 10 ảnh"),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type UpdatePotentialInput = z.infer<typeof updatePotentialSchema>;
export type QuoteDesk = z.infer<typeof quoteDeskSchema>;
export type QuoteLine = z.infer<typeof quoteLineSchema>;
export type QuoteOrder = z.infer<typeof quoteOrderSchema>;
export type QuoteNotes = z.infer<typeof quoteNotesSchema>;
export type QuoteBank = z.infer<typeof quoteBankSchema>;

export const defaultQuoteBank: QuoteBank = {
  title: "Tài khoản ngân hàng ACH",
  accountName: "SPEEGO LOGISTICS LLC",
  accountNumber: "0370750653",
  routingNumber: "111900785",
};

export type SentQuote = {
  sentAt: string;
  order: QuoteOrder;
  notes: QuoteNotes;
  bank: QuoteBank;
};
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type ReassignQuoteInput = z.infer<typeof reassignQuoteSchema>;
export type QuoteTemplateInput = z.infer<typeof quoteTemplateSchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
export type OpsContractInput = z.infer<typeof opsContractSchema>;
export type AccountingContractInput = z.infer<typeof accountingContractSchema>;
