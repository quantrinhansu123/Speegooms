import { defaultQuoteBank, quoteLineImages, type QuoteBank, type QuoteLine, type QuoteNotes, type QuoteOrder } from "./crm";
import { quoteMoneyValue } from "./quote-amounts";
import { quoteAttrKeyEn, quoteCompanyLabels, quoteDisplayUnit, quotePrintText, type QuoteLang, type QuotePrintText } from "./quote-print-text";

/** Thông tin pháp nhân in ở đầu thư. Giá trị dùng chung cho mọi ngôn ngữ. */
export const quoteCompany = {
  name: "CÔNG TY TNHH SPEEGO LOGISTICS",
  values: [
    "Tầng 24, Leadvisors Tower, 643 Phạm Văn Đồng, Phường Nghĩa Đô, HN",
    "01 Đường số 4, KDC Cityland Park Hills, phường Gò Vấp, HCM",
    "7303 Breen Dr, Houston, TX 77086, US",
    "079.673.8695",
    "sales@speegologistic.com",
  ],
} as const;

export interface QuoteSheetCustomer {
  customerName: string | null;
  companyName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface QuoteSheetInput {
  customer: QuoteSheetCustomer;
  lines: QuoteLine[];
  currency?: string;
  /** Các loại tiền thêm của đơn (cột đơn giá + thành tiền). */
  priceColumns?: QuoteOrder["priceColumns"];
  notes: QuoteNotes;
  bank: QuoteBank;
  code?: string | null;
  orderName?: string | null;
  issuedOn?: string | null;
  lang?: QuoteLang;
  /** Cân nặng tính phí và CBM của cả đơn, đã tính riêng từng kiện. */
  freightMetrics?: { chargeableKg: number; cbm: number } | null;
}

export interface QuoteSheetLine {
  stt: string;
  productName: string;
  images: string[];
  quantity: number | null;
  /** Đơn vị tính của số lượng, ví dụ "set". */
  unit: string;
  /** Kg, m2 hoặc CBM mỗi đơn vị hàng khi tính giá theo kg/m2/CBM; thành tiền = số lượng × định mức × đơn giá. */
  metric: number | null;
  /** Đơn vị của định mức, ví dụ "kg/set". Rỗng khi không tính theo kg/m2/CBM. */
  metricUnit: string;
  price: number | null;
  /** Hậu tố đơn giá theo cách tính, ví dụ "/kg". Rỗng khi tính theo đơn vị. */
  priceUnit: string;
  basis: QuoteLine["basis"];
  total: number | null;
  extra: { currency: string; price: number | null; total: number | null; totalManual: boolean }[];
  totalManual: boolean;
  spec: string;
  note: string;
}

export interface QuoteSheetFee {
  label: string;
  /** Chuỗi gốc người nhập. */
  text: string;
  /** Số đã đọc được, null nếu là chữ. */
  amount: number | null;
  /** Loại tiền hiệu lực (rỗng đã được thay bằng tiền chính của đơn). */
  currency: string;
  itemStt: string;
}

export interface QuoteSheetModel {
  lang: QuoteLang;
  t: QuotePrintText;
  currency: string;
  /** Loại tiền thêm, theo thứ tự cột. */
  extraCurrencies: string[];
  meta: { code: string; issuedOn: string; orderName: string };
  company: { name: string; rows: [string, string][] };
  customerRows: [string, string][];
  lines: QuoteSheetLine[];
  /** cbm: tổng CBM của đơn = CBM mỗi đơn vị × số lượng. */
  totals: { goods: number | null; extra: Record<string, number | null>; cbm: number; priced: boolean };
  totalLabel: string;
  weightNote: string;
  validityNote: string;
  /** Tổng chi phí vận chuyển người nhập tay (nguyên văn) và số đã đọc được (null nếu là chữ). */
  shippingText: string;
  shippingAmount: number | null;
  fees: QuoteSheetFee[];
  /** Tổng phí logistics theo từng loại tiền, chỉ khi chưa có tổng nhập tay. */
  feeSubtotals: { currency: string; amount: number }[];
  /** Bảng cước vận chuyển in cho khách. */
  freight: QuoteSheetFreight;
  deposit: string[];
  bank: { title: string; rows: [string, string][] };
  /** Bản tiếng Anh: các ô tự điền đã có tiếng Việt nhưng chưa có tiếng Anh (để trống trên bản in). */
  missing: string[];
}

export interface QuoteSheetFreight {
  rate: number | null;
  chargeableKg: number | null;
  chargeableCbm: number | null;
  total: number | null;
  note: string;
}

export interface QuoteSheetDeps {
  /** Mô tả đóng gói theo ngôn ngữ (đặt ở frontend vì cần công thức quy đổi kiện). */
  packagesNote: (line: QuoteLine, lang: QuoteLang) => string;
}

function filledLine(line: QuoteLine): boolean {
  return Boolean(
    line.stt.trim()
    || line.productName?.trim()
    || quoteLineImages(line).length > 0
    || line.quantity != null
    || line.pricePerSet != null
    || line.lineTotal != null
    || line.weightKg != null
    || line.cbm != null
    || line.areaM2 != null
    || line.spec.trim()
    || line.note.trim()
    || line.packages.length > 0
    || line.attrs.some((item) => item.key.trim() || item.value.trim()),
  );
}

function priceUnitOf(basis: QuoteLine["basis"], t: QuotePrintText): string {
  return { unit: "", kg: t.perKg, m2: t.perM2, cbm: t.perCbm, lump: t.perLump }[basis];
}

/** Định mức mỗi đơn vị hàng theo cách tính giá; null khi tính theo đơn vị hoặc trọn gói. */
function metricOf(line: QuoteLine): number | null {
  if (line.basis === "kg") return line.weightKg;
  if (line.basis === "m2") return line.areaM2;
  if (line.basis === "cbm") return line.cbm;
  return null;
}

const METRIC_LABEL = { kg: "kg", m2: "m2", cbm: "CBM" } as const;

type PickText = (vi: string | undefined, en: string | undefined, label: string) => string;

function attrsTextOf(line: QuoteLine, lang: QuoteLang, pick: PickText, where: string): string[] {
  return line.attrs.flatMap((a) => {
    const key = lang === "en" ? a.keyEn?.trim() || quoteAttrKeyEn[a.key.trim()] || "" : a.key.trim();
    if (lang === "en" && a.key.trim() && !key) pick(a.key, "", `Tên thuộc tính "${a.key.trim()}" (${where})`);
    const value = pick(a.value, a.valueEn, `Thuộc tính "${a.key.trim() || a.value.trim()}" (${where})`);
    if (!key && !value) return [];
    return [key ? `${key}: ${value}` : value];
  });
}

function lineNoteOf(line: QuoteLine, lang: QuoteLang, deps: QuoteSheetDeps, pick: PickText, where: string): string {
  const attrs = attrsTextOf(line, lang, pick, where);
  return [deps.packagesNote(line, lang), ...attrs, pick(line.note, line.noteEn, `Ghi chú (${where})`)].filter(Boolean).join("\n");
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function freightOf(notes: QuoteNotes, metrics: QuoteSheetInput["freightMetrics"], note: string): QuoteSheetFreight {
  const stored = notes.freight ?? { rate: null, total: null, totalManual: false };
  const chargeableKg = metrics && metrics.chargeableKg > 0 ? metrics.chargeableKg : null;
  const chargeableCbm = metrics && metrics.cbm > 0 ? metrics.cbm : null;
  const auto = stored.rate != null && chargeableKg != null ? round3(stored.rate * chargeableKg) : null;
  return {
    rate: stored.rate,
    chargeableKg,
    chargeableCbm,
    total: stored.totalManual ? stored.total : auto,
    note,
  };
}

/** Bank trống thì dùng tài khoản ACH mặc định để bản in luôn có thông tin thanh toán. */
export function effectiveQuoteBank(bank: QuoteBank | null | undefined): QuoteBank {
  const orDefault = (value: string | undefined, fallback: string) => (value?.trim() ? value.trim() : fallback);
  return {
    title: orDefault(bank?.title, defaultQuoteBank.title),
    accountName: orDefault(bank?.accountName, defaultQuoteBank.accountName),
    accountNumber: orDefault(bank?.accountNumber, defaultQuoteBank.accountNumber),
    routingNumber: orDefault(bank?.routingNumber, defaultQuoteBank.routingNumber),
  };
}

export function buildQuoteSheetModel(input: QuoteSheetInput, deps: QuoteSheetDeps): QuoteSheetModel {
  const lang = input.lang ?? "vi";
  const t = quotePrintText[lang];
  const missing = new Set<string>();
  /** Tiếng Việt dùng bản gốc; tiếng Anh chỉ dùng bản người dùng điền, thiếu thì để trống và ghi nhận. */
  const pick: PickText = (vi, en, label) => {
    const viText = vi?.trim() ?? "";
    if (lang !== "en") return viText;
    const enText = en?.trim() ?? "";
    if (viText && !enText) missing.add(label);
    return enText;
  };
  const currency = (input.currency ?? "VND").toUpperCase();
  const extraCurrencies = [...new Set((input.priceColumns ?? []).map((column) => column.currency.toUpperCase()))]
    .filter((code) => code !== currency)
    .slice(0, 8);
  const filled = input.lines.filter(filledLine);
  const lines: QuoteSheetLine[] = filled.map((line, lineIndex) => {
    const metric = metricOf(line);
    const unit = quoteDisplayUnit(line.unit, lang);
    return {
    stt: line.stt,
    productName: line.productName?.trim() ?? "",
    images: quoteLineImages(line),
    quantity: line.quantity,
    unit,
    metric: metric != null && metric > 0 ? metric : null,
    metricUnit: metric != null && metric > 0 ? `${METRIC_LABEL[line.basis as keyof typeof METRIC_LABEL]}/${unit}` : "",
    price: line.pricePerSet,
    priceUnit: line.pricePerSet == null ? "" : priceUnitOf(line.basis, t),
    basis: line.basis,
    total: line.lineTotal,
    totalManual: line.lineTotalManual === true,
    extra: extraCurrencies.map((code) => {
      const price = line.prices.find((item) => item.currency.toUpperCase() === code);
      return { currency: code, price: price?.pricePerSet ?? null, total: price?.lineTotal ?? null, totalManual: price?.lineTotalManual === true };
    }),
    spec: pick(line.spec, line.specEn, `Quy cách (dòng ${lineIndex + 1})`),
    note: lineNoteOf(line, lang, deps, pick, `dòng ${lineIndex + 1}`),
    };
  });
  const priced = lines.some((line) => line.total != null);
  const extraTotals: Record<string, number | null> = {};
  for (const code of extraCurrencies) {
    const values = lines.map((line) => line.extra.find((item) => item.currency === code)?.total).filter((v): v is number => v != null);
    extraTotals[code] = values.length > 0 ? round3(values.reduce((sum, v) => sum + v, 0)) : null;
  }
  const notes = input.notes;
  const shippingText = notes.shippingLabel?.trim() ?? "";
  /** Dòng phí gắn mặt hàng có tên tự sinh: tiếng Anh dùng "Item <STT>" kèm quy cách tiếng Anh của mặt hàng đó. */
  const itemLabelEn = (stt: string) => {
    const line = input.lines.find((item, i) => (item.stt.trim() || String(i + 1)) === stt);
    return quoteItemFeeLabel("en", stt, line?.specEn);
  };
  const fees: QuoteSheetFee[] = (notes.logisticsFees ?? [])
    .map((fee) => ({
      label: lang === "en"
        ? fee.itemStt?.trim() ? itemLabelEn(fee.itemStt.trim()) : pick(fee.label, fee.labelEn, `Tên chi phí "${fee.label.trim()}"`)
        : fee.label.trim(),
      text: fee.value.trim(),
      amount: quoteMoneyValue(fee.value),
      currency: (fee.currency?.trim() || currency).toUpperCase(),
      itemStt: fee.itemStt?.trim() ?? "",
    }))
    .filter((fee) => fee.label || fee.text);
  const subtotalByCurrency = new Map<string, number>();
  for (const fee of fees) {
    if (fee.amount != null) subtotalByCurrency.set(fee.currency, round2((subtotalByCurrency.get(fee.currency) ?? 0) + fee.amount));
  }
  const customer = input.customer;
  const validityNote = pick(notes.validityNote, notes.validityNoteEn, "Hiệu lực báo giá");
  const customerRows: [string, string][] = [
    [t.customer, customer.customerName?.trim() ?? ""],
    [t.company, customer.companyName?.trim() ?? ""],
    [t.address, customer.address?.trim() ?? ""],
    [t.phone, customer.phone?.trim() ?? ""],
    [t.email, customer.email?.trim() ?? ""],
    [t.validity, validityNote],
  ];
  const bank = effectiveQuoteBank(input.bank);
  const labels = quoteCompanyLabels[lang];
  return {
    lang,
    t,
    currency,
    extraCurrencies,
    meta: { code: input.code?.trim() ?? "", issuedOn: input.issuedOn?.trim() ?? "", orderName: input.orderName?.trim() ?? "" },
    company: { name: quoteCompany.name, rows: quoteCompany.values.map((value, index) => [labels[index] ?? "", value] as [string, string]) },
    customerRows,
    lines,
    totals: {
      goods: priced ? round3(lines.reduce((sum, line) => sum + (line.total ?? 0), 0)) : null,
      extra: extraTotals,
      cbm: Math.round(filled.reduce((sum, line) => sum + (line.cbm ?? 0) * (line.quantity ?? 1), 0) * 1000) / 1000,
      priced,
    },
    totalLabel: notes.totalLabel?.trim() || t.defaultTotalLabel,
    weightNote: pick(notes.weightNote, notes.weightNoteEn, "Ghi chú cân nặng / CBM"),
    validityNote,
    shippingText,
    shippingAmount: quoteMoneyValue(shippingText),
    fees,
    feeSubtotals: shippingText ? [] : [...subtotalByCurrency].map(([code, amount]) => ({ currency: code, amount })),
    freight: freightOf(notes, input.freightMetrics, t.freightNote),
    deposit: notes.deposit
      .map((line, index) => pick(line, notes.depositEn?.[index], `Đặt cọc (dòng ${index + 1})`))
      .filter(Boolean),
    bank: {
      title: bank.title,
      rows: [
        [t.accountName, bank.accountName],
        [t.accountNumber, bank.accountNumber],
        [t.routingNumber, bank.routingNumber],
      ],
    },
    missing: [...missing],
  };
}

/** Tên dòng chi phí của một mặt hàng: STT kèm dòng đầu của quy cách. */
export function quoteItemFeeLabel(lang: QuoteLang, stt: string, spec: string | undefined): string {
  const head = spec?.trim().split("\n")[0]?.slice(0, 40) ?? "";
  const prefix = lang === "en" ? `Item ${stt}` : `Mặt hàng ${stt}`;
  return head ? `${prefix} - ${head}` : prefix;
}

/** Bản ghi báo giá (hoặc bản nháp trong editor) đủ thông tin để dựng bản in. */
export type QuoteSheetSource = QuoteSheetCustomer & { code: string; notes: QuoteNotes; bank: QuoteBank };

export function quoteSheetInputOf(source: QuoteSheetSource, order: QuoteOrder, lang?: QuoteLang, issuedOn?: string | null): QuoteSheetInput {
  return {
    customer: source,
    lines: order.lines,
    currency: order.currency,
    priceColumns: order.priceColumns,
    notes: source.notes,
    bank: source.bank,
    code: source.code,
    orderName: order.name,
    issuedOn,
    lang,
  };
}

/** Tên file tải về: mã báo giá, tên mẫu và ngôn ngữ. */
export function quoteFileBase(code: string, orderName: string, lang: QuoteLang = "vi"): string {
  return `${code || "bao-gia"}${orderName ? `-${orderName}` : ""}-${lang}`;
}

export function safeQuoteFilename(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim();
  return cleaned || "bao-gia";
}
