import { z } from "zod";

export const crmLaneSchema = z.enum(["vn", "global"]);
export type CrmLane = z.infer<typeof crmLaneSchema>;

export const leadSourceSchema = z.enum(["ADS", "GG", "OG", "AF", "REFERRAL", "OUTBOUND", "OTHER"]);
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
export const customerKindSchema = z.enum(["SOURCING", "LOGISTICS"]);
export const potentialStatusSchema = z.enum(["POTENTIAL", "CLOSING", "DEPOSITED", "NOT_ORDERED"]);
export const leadClassificationSchema = z.enum(["LCL", "FCL"]);
export const shippingModeSchema = z.enum(["AIR", "SEA"]);
export const careChannelSchema = z.enum(["FACEBOOK", "ZALO", "WHATSAPP", "VIBER"]);
export const industryCategoryValues = {
  NAIL_SPA_SUPPLIES: "NAIL_SPA_SUPPLIES",
  NAIL_SPA_EQUIPMENT: "NAIL_SPA_EQUIPMENT",
  NAIL_SPA_FURNITURE: "NAIL_SPA_FURNITURE",
  BATHROOM_MATERIALS: "BATHROOM_MATERIALS",
  DECOR_SIGNAGE: "DECOR_SIGNAGE",
  FNB_FURNITURE: "FNB_FURNITURE",
  HOME_FURNITURE: "HOME_FURNITURE",
  FNB_KITCHEN_EQUIPMENT: "FNB_KITCHEN_EQUIPMENT",
  NAIL_DISPOSABLES_PACKAGING: "NAIL_DISPOSABLES_PACKAGING",
  HOME_ELECTRONICS: "HOME_ELECTRONICS",
  FASHION_ACCESSORIES: "FASHION_ACCESSORIES",
  OTHER: "OTHER",
} as const;
export const industryCategorySchema = z.enum(industryCategoryValues);
export type IndustryCategory = z.infer<typeof industryCategorySchema>;
export const industryCategoryOptions = [
  [industryCategoryValues.NAIL_SPA_SUPPLIES, "Vật tư & hóa mỹ phẩm Nail/Spa"],
  [industryCategoryValues.NAIL_SPA_EQUIPMENT, "Máy móc & thiết bị tiệm Nail/Spa"],
  [industryCategoryValues.NAIL_SPA_FURNITURE, "Ghế & nội thất tiệm Nail/Spa"],
  [industryCategoryValues.BATHROOM_MATERIALS, "Vật liệu & thiết bị nhà tắm"],
  [industryCategoryValues.DECOR_SIGNAGE, "Decor & bảng hiệu"],
  [industryCategoryValues.FNB_FURNITURE, "Nội thất nhà hàng / quán F&B"],
  [industryCategoryValues.HOME_FURNITURE, "Nội thất nhà ở"],
  [industryCategoryValues.FNB_KITCHEN_EQUIPMENT, "Máy móc & dụng cụ bếp quán F&B"],
  [industryCategoryValues.NAIL_DISPOSABLES_PACKAGING, "Đồ dùng một lần tiệm nail & bao bì"],
  [industryCategoryValues.HOME_ELECTRONICS, "Đồ điện tử gia dụng"],
  [industryCategoryValues.FASHION_ACCESSORIES, "Thời trang & phụ kiện"],
  [industryCategoryValues.OTHER, "Khác"],
] as const;

const text = (max: number) => z.string().trim().max(max);
const phonePattern = /^(?=.*\d)[+\d(). -]+$/;
const phoneError = "Số điện thoại chỉ được chứa số, dấu +, ngoặc, khoảng trắng, dấu chấm hoặc gạch ngang";

function contact(value: { phone: string; email: string }, ctx: z.RefinementCtx) {
  if (!value.phone && !value.email) {
    ctx.addIssue({ code: "custom", message: "Cần số điện thoại hoặc email", path: ["phone"] });
  }
  if (value.phone && !phonePattern.test(value.phone)) {
    ctx.addIssue({ code: "custom", message: phoneError, path: ["phone"] });
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

/** Mess chỉ kiểm tra định dạng SĐT/email khi có nhập; không bắt buộc phải có. */
function contactFormat(value: { phone: string; email: string }, ctx: z.RefinementCtx) {
  if (value.phone && !phonePattern.test(value.phone)) {
    ctx.addIssue({ code: "custom", message: phoneError, path: ["phone"] });
  }
  if (value.email && !z.string().email().safeParse(value.email).success) {
    ctx.addIssue({ code: "custom", message: "Email không đúng định dạng", path: ["email"] });
  }
}

const messageFields = {
  customerName: z.string().trim().min(1, "Nhập tên khách").max(160),
  phone: text(30),
  email: text(160),
  /** Nguồn (SPEEGO NAIL, SPEEGO US…). Khách tiềm năng chuyển từ mess dùng luôn nguồn này. */
  brand: leadBrandSchema.optional(),
  goods: text(500),
  industry: industryCategorySchema.optional(),
  note: text(2000),
  demand: messageDemandSchema.optional(),
  customerType: customerTypeSchema.optional(),
  receivedOn: receivedOn.optional(),
  market: z.string().trim().min(1, "Nhập thị trường").max(160),
  classification: messageClassificationSchema.optional(),
  saleName: text(160),
  painPoint: text(2000),
  linkMess: text(500),
  /** Nháp thông tin sản phẩm/đơn hàng do Sale nhập trên mess. undefined: giữ nguyên, null: xóa. */
  order: z.lazy(() => quoteOrderSchema).nullish(),
};

/**
 * `source: "OTHER"` (Khác): khách Sale tạo tay ở màn Khách hàng tiềm năng, không đến từ kênh quảng cáo/mess.
 * Bỏ trống thì giữ nguồn mặc định của mess.
 */
export const createMessageSchema = z.object({ ...messageFields, source: z.literal("OTHER").optional() }).superRefine(contactFormat);

export const updateMessageSchema = z.object(messageFields).superRefine(contactFormat);

export const updatePotentialSchema = z
  .object({
    handlerId: z.string().trim().min(1).max(160).optional(),
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
    packageDimensions: text(500).optional(),
    weightKg: text(500).optional(),
    logisticsClass: leadClassificationSchema.optional(),
    shippingMode: shippingModeSchema.optional(),
    shipFromAddress: text(2000).optional(),
    shipToAddress: text(2000).optional(),
    requirements: text(8000).optional(),
    requirementImages: z.array(z.string().max(100_000).refine(
      (value) => value.startsWith("data:image/") || /^https:\/\//.test(value),
      "Ảnh không hợp lệ",
    )).max(20, "Tối đa 20 ảnh").optional(),
    convertReason: text(2000).optional(),
  })
  .superRefine(contact);

export const convertMessageSchema = z.object({
  handlerId: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().min(1, "Nhập số điện thoại").max(30).regex(phonePattern, phoneError),
  /** Bỏ trống thì lấy Nguồn đã chọn trên mess. */
  brand: leadBrandSchema.optional(),
  customerType: z.enum(customerTypeSchema.options, { error: "Chọn đối tượng" }),
  careChannel: z.enum(careChannelSchema.options, { error: "Chọn kênh chăm sóc" }),
  productInterest: z.string().trim().min(1, "Nhập hàng hóa").max(500),
  address: text(300),
  saleNote: z.string().trim().min(1, "Nhập ghi chú sale").max(2000),
  requirements: z.string().trim().min(1, "Nhập yêu cầu của khách").max(8000),
  /** Chỉ bắt buộc với khách Logistics (có phương thức vận chuyển); đơn Sourcing ghi số lượng trên từng dòng hàng. */
  quantityNote: text(500).optional(),
  packageDimensions: text(500).optional(),
  weightKg: text(500).optional(),
  shippingMode: shippingModeSchema.optional(),
  logisticsClass: leadClassificationSchema.optional(),
  shipFromAddress: text(2000).optional(),
  shipToAddress: text(2000).optional(),
  images: z.array(z.string().max(100_000).refine(
    (value) => value.startsWith("data:image/") || /^https:\/\//.test(value),
    "Ảnh không hợp lệ",
  )).max(20, "Tối đa 20 ảnh").default([]),
  reason: z.string().trim().max(2000).default(""),
}).superRefine((input, ctx) => {
  if (input.shippingMode && !input.quantityNote?.trim()) ctx.addIssue({ code: "custom", message: "Nhập số lượng", path: ["quantityNote"] });
  if (input.shippingMode && !input.shipToAddress?.trim()) ctx.addIssue({ code: "custom", message: "Nhập địa chỉ nhận hàng", path: ["shipToAddress"] });
  if (input.shippingMode && !input.reason.trim()) ctx.addIssue({ code: "custom", message: "Nhập lý do chuyển", path: ["reason"] });
  if (input.shippingMode === "SEA" && !input.logisticsClass) {
    ctx.addIssue({ code: "custom", message: "Chọn LCL hoặc FCL", path: ["logisticsClass"] });
  }
  if (input.shippingMode === "AIR" && input.logisticsClass) {
    ctx.addIssue({ code: "custom", message: "Đường bay không phân loại LCL/FCL", path: ["logisticsClass"] });
  }
});

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

/** Tỷ giá quy đổi VND: số VND cho 1 đơn vị ngoại tệ. */
const vndRate = z.number().finite().positive("Tỷ giá quy đổi VND phải lớn hơn 0").max(10_000_000).nullable();

const dim = z.number().min(0, "Số không được âm").max(100_000);

export const quotePackageSchema = z.object({
  count: z.number().int("Số kiện phải là số nguyên").min(1, "Số kiện tối thiểu là 1").max(10_000, "Số kiện quá lớn"),
  lengthCm: dim,
  widthCm: dim,
  heightCm: dim,
  actualKg: dim,
});

/** key/value là tiếng Việt; keyEn/valueEn là bản tiếng Anh do người dùng điền (không tự dịch). */
export const quoteAttrSchema = z.object({
  key: text(80),
  value: text(300),
  keyEn: text(80).default(""),
  valueEn: text(300).default(""),
});

const quoteImage = z.string().max(100_000).refine(
  (value) => value === "" || value.startsWith("data:image/") || /^https:\/\//.test(value),
  "Ảnh không hợp lệ",
);

/** Danh sách tiền tệ gợi ý. Cho phép thêm mã mới (3 chữ cái) khi báo giá. */
export const quoteCurrencies = ["VND", "USD", "AUD", "EUR", "GBP", "CAD", "SGD", "CNY", "JPY"] as const;
export const quoteCurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Mã tiền tệ gồm 3 chữ cái (ví dụ USD)")
  .default("VND");
export type QuoteCurrency = string;

/** Đơn giá và thành tiền của một dòng theo một loại tiền. */
export const quoteLinePriceSchema = z.object({
  currency: quoteCurrencySchema,
  pricePerSet: amount,
  lineTotal: amount,
  /** true khi thành tiền được ghi đè, không tính lại theo công thức. */
  lineTotalManual: z.boolean().default(false),
});

/** Cột đơn giá thêm trên đơn hàng. Tỷ giá là số VND cho 1 đơn vị ngoại tệ. */
export const quotePriceColumnSchema = z.object({
  currency: quoteCurrencySchema,
  rate: z.number().positive("Tỷ giá phải lớn hơn 0").max(1_000_000).nullable().default(null),
});

export const quoteLineSchema = z.object({
  /** Giá gốc nội bộ theo loại tiền/cách tính giá của dòng. */
  originalPrice: amount.optional(),
  stt: text(20),
  productName: text(300).optional(),
  /** Ảnh chính (tương thích cũ) = phần tử đầu của images. */
  image: quoteImage.default(""),
  /** Nhiều ảnh sản phẩm trên một dòng báo giá. */
  images: z.array(quoteImage).max(8, "Tối đa 8 ảnh mỗi dòng").default([]),
  quantity: amount,
  pricePerSet: amount,
  lineTotal: amount,
  /** true khi thành tiền chính được ghi đè tay. */
  lineTotalManual: z.boolean().default(false),
  /** Cân nặng mỗi đơn vị hàng; thành tiền kg = đơn giá × kg/đơn vị × số lượng. */
  weightKg: amount,
  spec: text(4000),
  note: text(4000),
  /** Bản tiếng Anh của quy cách và ghi chú, do người dùng điền. */
  specEn: text(4000).default(""),
  noteEn: text(4000).default(""),
  /** Đơn vị tính: cái, bộ, kg, cbm, lô... */
  unit: text(20).default("cái"),
  /** Cách tính giá: theo đơn vị, theo kg/m2/CBM mỗi đơn vị × số lượng, hoặc trọn gói. */
  basis: z.enum(["unit", "kg", "m2", "cbm", "lump"]).default("unit"),
  cbm: amount.default(null),
  /** Diện tích (m2) mỗi đơn vị hàng khi tính giá theo m2. */
  areaM2: amount.default(null),
  /** Quy cách đóng gói. CBM và cân tổng từ kiện được chia theo số lượng để lưu theo đơn vị hàng. */
  packages: z.array(quotePackageSchema).max(20, "Tối đa 20 kiện mỗi dòng").default([]),
  /** Thuộc tính tự do: chất liệu, bảo hành, thời gian sản xuất... */
  attrs: z.array(quoteAttrSchema).max(20, "Tối đa 20 thuộc tính mỗi dòng").default([]),
  /** Đơn giá theo loại tiền khác currency của đơn. Currency chính vẫn nằm ở pricePerSet. */
  prices: z.array(quoteLinePriceSchema).max(8, "Tối đa 8 loại tiền mỗi dòng").default([]),
});

/** Danh sách ảnh dòng: ưu tiên images[], fallback image cũ. */
export function quoteLineImages(line: { image?: string | null; images?: string[] | null }): string[] {
  const list = (line.images ?? []).map((item) => item.trim()).filter(Boolean);
  if (list.length > 0) return list;
  const single = line.image?.trim() ?? "";
  return single ? [single] : [];
}

const depositLine = text(300);

/** Cước vận chuyển: giá cước × cân nặng tính phí. Cân và thể tích lấy từ từng kiện khi in. */
const freightDetailsSchema = z.object({
  currency: z.string().trim().toUpperCase().regex(/^$|^[A-Z]{3}$/).default(""),
  vndRate: vndRate.optional(),
  rate: amount.optional(),
  quantity: amount.optional(),
});

export const quoteFreightSchema = z.object({
  originalDetails: freightDetailsSchema.optional(),
  /** Tổng giá gốc cước nội bộ; báo giá cũ dùng loại tiền cước, bản mới có originalDetails. */
  originalPrice: amount.optional(),
  /** Giá cước trên mỗi kg tính phí. */
  rate: amount,
  /** Giá cước trên mỗi CBM tính phí. */
  cbmRate: amount.default(null),
  /** kg, CBM, mặt hàng hoặc trọn gói (tiền cước nhập tay). "both" (cộng kg và CBM) chỉ còn để đọc báo giá cũ. */
  basis: z.enum(["kg", "cbm", "both", "item", "lump"]).default("kg"),
  /** Rỗng = loại tiền chính của đơn hàng. */
  currency: z.string().trim().toUpperCase().regex(/^$|^[A-Z]{3}$/).default(""),
  /** Tổng chi phí. Khi totalManual = false, in sẽ tính rate × cân nặng tính phí. */
  total: amount,
  totalManual: z.boolean().default(false),
  /** Số VND cho 1 đơn vị loại tiền chi phí logistics, để quy đổi tổng về VND (không in ra phiếu). */
  vndRate: vndRate.optional(),
});

export const emptyQuoteFreight = { rate: null, cbmRate: null, basis: "kg" as const, currency: "", total: null, totalManual: false, vndRate: null };

/** Dòng chi phí logistics (cảng biển, vận chuyển, local…) — tự thêm trên báo giá. */
export const logisticsFeeSchema = z.object({
  originalDetails: freightDetailsSchema.optional(),
  rate: amount.optional(),
  weightKg: amount.optional(),
  vndRate: vndRate.optional(),
  originalPrice: amount.optional(),
  label: text(120),
  /** Tên dòng phí bằng tiếng Anh. */
  labelEn: text(120).default(""),
  value: text(300),
  /** Loại tiền của dòng phí. Rỗng = dùng loại tiền chính của đơn. */
  currency: z.string().trim().toUpperCase().regex(/^$|^[A-Z]{3}$/, "Mã tiền tệ gồm 3 chữ cái").default(""),
  /** STT mặt hàng mà dòng phí này báo giá. Rỗng = phí chung của đơn. */
  itemStt: text(20).default(""),
});

export const fclQuoteSchema = z.object({
  to: text(160).default(""),
  pol: text(160).default(""),
  pod: text(200).default(""),
  etd: text(80).default(""),
  weight: text(80).default(""),
  volume: text(80).default(""),
  commodity: text(160).default(""),
  stuffingDate: text(80).default(""),
  charges: z.array(z.object({
    originalPrice: amount.optional(),
    name: text(160),
    rate: amount,
    quantity: z.number().min(0).max(1_000_000).nullable(),
    unit: text(60),
    vatAmount: z.number().min(0).max(1_000_000_000),
    note: text(300),
    optional: z.boolean().default(false),
  })).max(30),
  notes: text(2000).default(""),
});

export const quotePaymentSchema = z.object({
  quoteCurrency: quoteCurrencySchema,
  currency: quoteCurrencySchema,
  /** Số đơn vị tiền thanh toán cho 1 đơn vị tiền báo giá. */
  exchangeRate: z.number().finite().positive("Tỷ giá thanh toán phải lớn hơn 0").max(1_000_000).nullable(),
}).superRefine((value, ctx) => {
  if (value.currency !== value.quoteCurrency && value.exchangeRate == null) {
    ctx.addIssue({ code: "custom", message: "Nhập tỷ giá thanh toán", path: ["exchangeRate"] });
  }
});

/** Lưu ý chọn sẵn dưới phần Chi phí vận chuyển; nội dung in theo ngôn ngữ ở quote-print-text. */
export const shippingNoteKeys = ["measure", "estimate", "domesticCn", "prepay"] as const;
export type ShippingNoteKey = (typeof shippingNoteKeys)[number];

export const quoteNotesSchema = z.object({
  payment: quotePaymentSchema.optional(),
  totalLabel: text(300),
  /** Nhãn dòng tổng chi phí vận chuyển (phần Logistics trên mẫu in). */
  shippingLabel: text(300).default(""),
  weightNote: text(500),
  validityNote: text(500),
  /** Số ngày báo giá có hiệu lực, đếm từ lần gửi báo giá gần nhất. Bắt buộc khi gửi. */
  validityDays: z.number().int("Số ngày hiệu lực phải là số nguyên").min(1, "Số ngày hiệu lực tối thiểu 1").max(365, "Số ngày hiệu lực tối đa 365").nullable().optional(),
  /** Bản tiếng Anh của ghi chú cân nặng, hiệu lực và các dòng đặt cọc (depositEn[i] ứng với deposit[i]). */
  weightNoteEn: text(500).default(""),
  validityNoteEn: text(500).default(""),
  depositEn: z.array(depositLine).max(20, "Tối đa 20 dòng đặt cọc").default([]),
  deposit: z.union([
    depositLine,
    z.array(depositLine).max(20, "Tối đa 20 dòng đặt cọc"),
  ]).transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
  /** Chi phí logistics chi tiết (cảng, vận chuyển, thông quan…). */
  logisticsFees: z.array(logisticsFeeSchema).max(30, "Tối đa 30 dòng chi phí logistics").default([]),
  fcl: fclQuoteSchema.optional(),
  /** Bảng cước vận chuyển: giá cước, cân/thể tích tính phí và tổng. */
  freight: quoteFreightSchema.default(emptyQuoteFreight),
  /** Các lưu ý in dưới Chi phí vận chuyển (chọn nhiều). Chưa có (báo giá cũ) thì in lưu ý dự kiến cân nặng như trước. */
  shippingNotes: z.array(z.enum(shippingNoteKeys)).max(shippingNoteKeys.length).optional(),
  /** Lưu ý khác do Logistics tự điền; rỗng thì không in. */
  shippingNoteOther: text(1000).optional(),
  /** Ghi chú thêm của vận hành (tách lô, dời lịch…) để Sale xem. */
  opsExtra: text(2000).default(""),
});

export const quoteBankSchema = z.object({
  custom: z.boolean().optional(),
  bankName: text(200).optional(),
  swiftCode: text(80).optional(),
  title: text(200),
  accountName: text(200),
  accountNumber: text(80),
  routingNumber: text(80),
});

export const quoteOrderSchema = z.object({
  id: uuidText,
  /** Giá trị hàng khai báo khi khách thuần Logistics mua bảo hiểm. */
  insurance: z.boolean().optional(),
  name: z.string().trim().min(1, "Nhập tên thông tin đơn hàng").max(160),
  selected: z.boolean(),
  currency: quoteCurrencySchema.default("VND"),
  /** Tỷ giá: số VND cho 1 đơn vị ngoại tệ, chỉ dùng khi currency khác VND (để hiện quy đổi) */
  rate: z.number().positive("Tỷ giá phải lớn hơn 0").max(1_000_000).nullable().default(null),
  /** Các loại tiền thêm, ngoài currency chính. Mỗi loại thành một cặp cột đơn giá và thành tiền. */
  priceColumns: z.array(quotePriceColumnSchema).max(8, "Tối đa 8 cột đơn giá").default([]),
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
  if (value.notes.payment && value.bank.custom) {
    for (const key of ["bankName", "accountName", "accountNumber"] as const) {
      if (!value.bank[key]?.trim()) ctx.addIssue({ code: "custom", message: "Nhập đủ tên ngân hàng, chủ tài khoản và số tài khoản nhận tiền", path: ["bank", key] });
    }
  }
  if (value.orders.filter((order) => order.selected).length > 1) {
    ctx.addIssue({ code: "custom", message: "Chỉ chọn một mẫu báo giá", path: ["orders"] });
  }
});

export const reassignQuoteSchema = z.object({
  potentialId: uuidText,
});

export const updateQuoteOutcomeSchema = z.object({
  nonCloseReason: text(2000),
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
  product: text(15_000),
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

const contractImage = z.string().max(100_000).refine(
  (value) => value.startsWith("data:image/") || /^https:\/\//.test(value),
  "Ảnh không hợp lệ",
);

/** Cột J = tổng HĐ, cột O = kế toán xác nhận số tiền (sheet Hợp đồng). */
export function contractPaymentFlags(input: {
  totalValue: number;
  confirmedAmount: number | null | undefined;
  paidAmount?: number | null | undefined;
  balance?: number | null | undefined;
  deliveryOn: string | null | undefined;
  accountingStatus?: string | null | undefined;
  opsStatus?: string | null | undefined;
  today?: string;
}) {
  const cancelled = input.opsStatus === "Hủy đơn";
  const total = Number.isFinite(input.totalValue) ? input.totalValue : 0;
  const confirmed = input.confirmedAmount == null || !Number.isFinite(input.confirmedAmount)
    ? 0
    : input.confirmedAmount;
  const paid = input.paidAmount == null || !Number.isFinite(input.paidAmount) ? 0 : input.paidAmount;
  const balance = input.balance == null || !Number.isFinite(input.balance) ? null : input.balance;
  const status = input.accountingStatus ?? "";
  const fullyPaidByStatus = status === "DA_HOAN_THANH_THANH_TOAN";
  const depositDoneByStatus = status === "DA_HOAN_THANH_COC" || fullyPaidByStatus;
  const settledByBalance = total > 0 && ((balance != null && balance <= 0) || paid >= total);
  let effective = Math.max(confirmed, paid);
  if (fullyPaidByStatus || settledByBalance) effective = Math.max(effective, total);
  else if (depositDoneByStatus) effective = Math.max(effective, total * 0.5);
  const eligibleToShip = !cancelled && total > 0 && effective >= total * 0.5;
  const eligibleToDeliver = !cancelled && total > 0 && effective >= total;
  const deliveryOn = input.deliveryOn?.trim() || "";
  const today = (input.today ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  let urgePayment = false;
  if (!cancelled && deliveryOn && !eligibleToDeliver) {
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

function orderedContractDays(
  value: {
    chinaWarehouseOn: string;
    containerOn: string;
    arrivalOn: string;
    deliveryOn: string;
  },
  ctx: z.RefinementCtx,
) {
  const steps: Array<{ key: "chinaWarehouseOn" | "containerOn" | "arrivalOn" | "deliveryOn"; label: string; value: string }> = [
    { key: "chinaWarehouseOn", label: "Ngày nhập kho TQ", value: value.chinaWarehouseOn },
    { key: "containerOn", label: "Ngày xuất container", value: value.containerOn },
    { key: "arrivalOn", label: "Ngày cập cảng đến", value: value.arrivalOn },
    { key: "deliveryOn", label: "Ngày giao hàng dự kiến", value: value.deliveryOn },
  ];
  let previous: { label: string; value: string } | null = null;
  for (const step of steps) {
    if (!step.value) continue;
    if (previous && step.value < previous.value) {
      ctx.addIssue({
        code: "custom",
        message: `${step.label} không được trước ${previous.label}`,
        path: [step.key],
      });
      return;
    }
    previous = step;
  }
}

const requiredDay = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Nhập ngày giao hàng dự kiến");

export const opsContractSchema = z.object({
  opsStatus: z.union([z.literal(""), opsStatusSchema]),
  tracking: text(200),
  note1: text(2000),
  note2: text(2000),
  chinaWarehouseOn: day,
  containerOn: day,
  arrivalOn: day,
  deliveryOn: requiredDay,
  send: z.boolean().optional(),
}).superRefine(orderedContractDays);

/** Một lần khách chuyển khoản (kèm ảnh bill của lần đó). */
export const contractPaymentLineSchema = z.object({
  amount: money,
  /** Loại tiền của lần chuyển khoản. Cùng danh sách với ô Tỷ giá trên đơn hàng. */
  currency: quoteCurrencySchema.default("VND"),
  /**
   * Tỷ giá của lần này: 1 đơn vị tiền hợp đồng = bao nhiêu đơn vị loại tiền khách trả (ví dụ HĐ USD, trả VND: 25.500).
   * Riêng hợp đồng tính bằng VND thì ngược lại: 1 đơn vị loại tiền khách trả = bao nhiêu VND.
   */
  exchangeRate: z.number().finite().positive("Tỷ giá phải lớn hơn 0").max(1_000_000).nullable().default(null),
  paidOn: day,
  note: text(300),
  images: z.array(contractImage).max(10, "Tối đa 10 ảnh mỗi lần thanh toán").default([]),
});

/** Tỷ giá quy đổi VND theo từng loại tiền của hợp đồng (mã tiền → số VND cho 1 đơn vị). */
export const contractVndRatesSchema = z.record(z.string().regex(/^[A-Z]{3}$/), z.number().finite().positive("Tỷ giá quy đổi VND phải lớn hơn 0").max(10_000_000));

/** Sale cập nhật các lần thanh toán + ảnh bill theo từng lần; không sửa các cột thương mại khác. */
export const saleContractPaymentSchema = z.object({
  payments: z.array(contractPaymentLineSchema).max(50, "Tối đa 50 lần thanh toán"),
  /** Tỷ giá quy đổi VND của các khoản ngoại tệ trên hợp đồng. Bỏ trống thì giữ nguyên. */
  vndRates: contractVndRatesSchema.optional(),
});

/** Một lần kế toán xác nhận số tiền (kèm ảnh về TK của lần đó). */
export const accountingConfirmationLineSchema = z.object({
  amount: money.positive("Nhập số tiền xác nhận lớn hơn 0"),
  currency: quoteCurrencySchema.optional(),
  exchangeRate: z.number().finite().positive("Tỷ giá phải lớn hơn 0").max(1_000_000).nullable().default(null),
  note: text(300),
  images: z.array(contractImage).max(10, "Tối đa 10 ảnh mỗi lần xác nhận").default([]),
});

export const accountingContractSchema = z.object({
  accountingStatus: accountingStatusSchema,
  /** Nhiều lần xác nhận; tổng amount = số tiền kế toán xác nhận. */
  confirmations: z.array(accountingConfirmationLineSchema).min(1, "Nhập ít nhất một số tiền xác nhận").max(50, "Tối đa 50 lần xác nhận"),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type ConvertMessageInput = z.infer<typeof convertMessageSchema>;
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
export type UpdateQuoteOutcomeInput = z.infer<typeof updateQuoteOutcomeSchema>;
export type ReassignQuoteInput = z.infer<typeof reassignQuoteSchema>;
export type QuoteTemplateInput = z.infer<typeof quoteTemplateSchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
export type ContractPaymentLineInput = z.infer<typeof contractPaymentLineSchema>;
export type SaleContractPaymentInput = z.infer<typeof saleContractPaymentSchema>;
export type OpsContractInput = z.infer<typeof opsContractSchema>;
export type AccountingConfirmationLineInput = z.infer<typeof accountingConfirmationLineSchema>;
export type AccountingContractInput = z.infer<typeof accountingContractSchema>;
