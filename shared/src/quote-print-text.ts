/** Nhãn cố định của bản in / PDF / Excel báo giá theo ngôn ngữ. Nội dung nhập tay không dịch. */
export const quoteLangs = ["vi", "en"] as const;

export type QuoteLang = (typeof quoteLangs)[number];

export const quoteLangLabels: Record<QuoteLang, string> = { vi: "Tiếng Việt", en: "English" };

export interface QuotePrintText {
  title: string;
  customerInfo: string;
  orderDetails: string;
  customer: string;
  company: string;
  address: string;
  phone: string;
  email: string;
  validity: string;
  quoteNo: string;
  issuedOn: string;
  orderName: string;
  stt: string;
  image: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  product: string;
  /** Tiêu đề cột kg, m2 hoặc CBM mỗi đơn vị hàng. */
  metric: string;
  spec: string;
  note: string;
  empty: string;
  defaultTotalLabel: string;
  logisticsFee: string;
  shippingTotal: string;
  feeSubtotal: string;
  paymentInfo: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  partyA: string;
  partyB: string;
  signStamp: string;
  /** Hậu tố đơn giá theo cách tính, ví dụ "/kg". */
  perKg: string;
  perM2: string;
  perCbm: string;
  perLump: string;
  /** Tiêu đề hai cột chỉ có ở file Excel: cách tính giá và số nhân với đơn giá. */
  pricingBasis: string;
  /** Đơn vị mặc định của số lượng. */
  defaultUnit: string;
  freightTitle: string;
  freightRate: string;
  chargeableWeight: string;
  chargeableVolume: string;
  freightTotal: string;
  /** Dòng lưu ý cố định dưới bảng cước. */
  freightNote: string;
}

export const quotePrintText: Record<QuoteLang, QuotePrintText> = {
  vi: {
    title: "BÁO GIÁ",
    customerInfo: "Thông tin khách hàng",
    orderDetails: "CHI TIẾT ĐƠN HÀNG",
    customer: "Khách hàng",
    company: "Công ty",
    address: "Địa chỉ",
    phone: "Điện thoại",
    email: "Email",
    validity: "Hiệu lực",
    quoteNo: "Số báo giá",
    issuedOn: "Ngày báo giá",
    orderName: "Đơn hàng",
    stt: "STT",
    image: "Hình ảnh",
    quantity: "Số lượng",
    unitPrice: "Đơn giá",
    lineTotal: "Tổng tiền hàng",
    product: "Mặt hàng",
    metric: "Kg/CBM/m2",
    spec: "Quy cách",
    note: "Note",
    empty: "Chưa có dòng hàng",
    defaultTotalLabel: "Tổng giá trị hàng hóa chưa bao gồm phí vận chuyển",
    logisticsFee: "Chi phí logistics",
    shippingTotal: "Tổng chi phí vận chuyển",
    feeSubtotal: "Tổng chi phí logistics",
    paymentInfo: "Thông tin thanh toán",
    accountName: "Tên tài khoản (Account Name)",
    accountNumber: "Số tài khoản (Account Number)",
    routingNumber: "Routing Number",
    partyA: "ĐẠI DIỆN BÊN A",
    partyB: "ĐẠI DIỆN BÊN B",
    signStamp: "(Ký, đóng dấu)",
    perKg: "/kg",
    perM2: "/m2",
    perCbm: "/cbm",
    perLump: "/gói",
    pricingBasis: "Cách tính giá",
    defaultUnit: "cái",
    freightTitle: "Chi phí vận chuyển",
    freightRate: "Giá cước",
    chargeableWeight: "Cân nặng tính phí",
    chargeableVolume: "Thể tích tính phí",
    freightTotal: "Tổng chi phí",
    freightNote: "Lưu ý: Dự kiến số KG, có thể thay đổi theo thực tế",
  },
  en: {
    title: "QUOTATION",
    customerInfo: "Customer information",
    orderDetails: "ORDER DETAILS",
    customer: "Customer",
    company: "Company",
    address: "Address",
    phone: "Phone",
    email: "Email",
    validity: "Validity",
    quoteNo: "Quotation No.",
    issuedOn: "Date",
    orderName: "Order",
    stt: "No.",
    image: "Image",
    quantity: "Quantity",
    unitPrice: "Unit price",
    lineTotal: "Amount",
    product: "Product",
    metric: "Kg/CBM/m2",
    spec: "Specification",
    note: "Note",
    empty: "No items",
    defaultTotalLabel: "Total goods value excluding shipping cost",
    logisticsFee: "Logistics fee",
    shippingTotal: "Total shipping cost",
    feeSubtotal: "Total logistics fees",
    paymentInfo: "Payment information",
    accountName: "Account Name",
    accountNumber: "Account Number",
    routingNumber: "Routing Number",
    partyA: "PARTY A REPRESENTATIVE",
    partyB: "PARTY B REPRESENTATIVE",
    signStamp: "(Signature & stamp)",
    perKg: "/kg",
    perM2: "/m2",
    perCbm: "/cbm",
    perLump: "/lot",
    pricingBasis: "Pricing basis",
    defaultUnit: "pcs",
    freightTitle: "Shipping cost",
    freightRate: "Freight rate",
    chargeableWeight: "Chargeable weight",
    chargeableVolume: "Chargeable volume",
    freightTotal: "Total cost",
    freightNote: "Note: Estimated KG, may change based on actual shipment.",
  },
};

const genericQuoteUnits = new Set(["", "set", "cái", "cai", "pcs", "pc", "piece", "pieces"]);

/** Đơn vị số lượng trên file gửi khách: mặc định cái (vi) / pcs (en). Đơn vị tự nhập thì giữ nguyên. */
export function quoteDisplayUnit(unit: string | null | undefined, lang: QuoteLang): string {
  const trimmed = unit?.trim() ?? "";
  if (!genericQuoteUnits.has(trimmed.toLowerCase())) return trimmed;
  return quotePrintText[lang].defaultUnit;
}

/** Nhãn công ty cố định ở đầu thư: [vi, en]. */
export const quoteCompanyLabels: Record<QuoteLang, readonly string[]> = {
  vi: ["Địa chỉ HN", "Địa chỉ HCM", "Địa chỉ Mỹ", "Điện thoại", "Email"],
  en: ["Hanoi office", "HCMC office", "US office", "Phone", "Email"],
};

/** Tên thuộc tính xưởng cố định: bản tiếng Anh gán sẵn. Thuộc tính khác do người dùng điền. */
export const quoteAttrKeyEn: Record<string, string> = {
  "Chất liệu": "Material",
  MOQ: "MOQ",
  "Lead time": "Lead time",
  "Bảo hành": "Warranty",
};

const numberFormats = new Map<string, Intl.NumberFormat>();

/** Định dạng số theo ngôn ngữ in: vi 1.234,50 — en 1,234.50. Bộ định dạng được dùng lại giữa các lần gọi. */
export function formatQuoteNumber(value: number, lang: QuoteLang, maxDigits = 2): string {
  const minDigits = Number.isInteger(value) ? 0 : Math.min(maxDigits, 2);
  const key = `${lang}|${minDigits}|${maxDigits}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(lang === "en" ? "en-US" : "vi-VN", { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
    numberFormats.set(key, format);
  }
  return format.format(value);
}

export function isQuoteLang(value: unknown): value is QuoteLang {
  return (quoteLangs as readonly unknown[]).includes(value);
}
