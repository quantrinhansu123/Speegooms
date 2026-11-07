import type { QuoteNotes, QuoteOrder, SentQuote } from "./crm";

type QuoteAmountSource = {
  orders: Pick<QuoteOrder, "currency" | "rate" | "priceColumns" | "lines" | "selected">[];
  notes: QuoteNotes;
  shippingMode?: "AIR" | "SEA" | null;
  logisticsClass?: string | null;
  sentQuote?: SentQuote | null;
};

type QuoteAmount = { amount: number | null; currency: string; rate: number | null };

export type FclQuote = NonNullable<QuoteNotes["fcl"]>;

export function fclChargeTotal(charge: FclQuote["charges"][number]): number | null {
  if (charge.rate == null || charge.quantity == null) return null;
  // Cột VAT 8% trong file FCL chứa số tiền thuế nhập tay, được cộng trực tiếp vào thành tiền.
  return Math.round((charge.rate * charge.quantity + charge.vatAmount) * 100) / 100;
}

export function fclTotals(charges: FclQuote["charges"]) {
  const amount = (rows: FclQuote["charges"]) => Math.round(rows.reduce((sum, row) => sum + (fclChargeTotal(row) ?? 0), 0) * 100) / 100;
  return { base: amount(charges.filter((row) => !row.optional)), all: amount(charges) };
}

export function quoteMoneyValue(text: string): number | null {
  const value = text.trim().replace(/\s*(?:[A-Z]{3}|₫|đ|\$)\s*$/i, "").replace(/\s/g, "");
  if (!/^[\d.,]+$/.test(value)) return null;
  let normalized = value;
  if (value.includes(",")) normalized = value.lastIndexOf(".") > value.lastIndexOf(",")
    ? value.replace(/,/g, "") : value.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) normalized = value.replace(/\./g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function orderCurrencyOf(order: { currency: string } | undefined): string {
  return (order?.currency || "VND").toUpperCase();
}

/**
 * Cước chưa chọn loại tiền thì dùng loại tiền của phụ phí khi mọi phụ phí ghi rõ cùng một loại.
 * Không lấy loại tiền chính của đơn, để số USD không bị hiện thành VND.
 */
export function resolvedFreightCurrency(notes: Pick<QuoteNotes, "freight" | "logisticsFees"> | undefined, orderCurrency: string): string {
  const explicit = notes?.freight?.currency?.trim().toUpperCase();
  if (explicit) return explicit;
  const codes = [...new Set((notes?.logisticsFees ?? [])
    .map((fee) => fee.currency?.trim().toUpperCase())
    .filter((code): code is string => Boolean(code)))];
  return codes.length === 1 ? codes[0] : (orderCurrency || "VND").toUpperCase();
}

function rateOf(order: Pick<QuoteOrder, "currency" | "rate" | "priceColumns"> | undefined, currency: string): number | null {
  if (currency === "VND") return 1;
  if (order?.currency?.toUpperCase() === currency) return order.rate ?? null;
  return order?.priceColumns?.find((column) => column.currency.toUpperCase() === currency)?.rate ?? null;
}

export function quoteAmount(sheet: QuoteAmountSource | null | undefined, desk: "sourcing" | "logistics"): QuoteAmount {
  const order = sheet?.sentQuote?.order ?? sheet?.orders.find((item) => item.selected) ?? sheet?.orders[0];
  const notes = sheet?.sentQuote?.notes ?? sheet?.notes;
  const currency = orderCurrencyOf(order);
  if (!sheet || !notes) return { amount: 0, currency, rate: currency === "VND" ? 1 : order?.rate ?? null };
  /** Chi phí logistics ưu tiên tỷ giá VND nhập ở phần logistics, rồi mới tới tỷ giá của đơn hàng. */
  const fcl = desk === "logistics" && sheet.shippingMode === "SEA" && sheet.logisticsClass === "FCL" && notes.fcl;
  const logisticsCurrency = fcl ? notes.payment?.quoteCurrency ?? "USD" : resolvedFreightCurrency(notes, currency);
  const logisticsRate = (code: string) => code === "VND" ? 1
    : (code === logisticsCurrency ? notes.freight?.vndRate : null) ?? rateOf(order, code);
  if (fcl && notes.fcl) return { amount: fclTotals(notes.fcl.charges).all, currency: logisticsCurrency, rate: logisticsRate(logisticsCurrency) };
  if (desk === "logistics" && (notes.freight.total != null || notes.logisticsFees.length > 0)) {
    const freightCurrency = resolvedFreightCurrency(notes, currency);
    const buckets = new Map<string, number>();
    for (const fee of notes.logisticsFees) {
      const feeAmount = quoteMoneyValue(fee.value);
      if (feeAmount == null) return { amount: null, currency: freightCurrency, rate: logisticsRate(freightCurrency) };
      // Phụ phí không ghi loại tiền thì theo loại tiền cước.
      const code = (fee.currency?.trim() || freightCurrency).toUpperCase();
      buckets.set(code, (buckets.get(code) ?? 0) + feeAmount);
    }
    if (notes.freight.total != null) buckets.set(freightCurrency, (buckets.get(freightCurrency) ?? 0) + notes.freight.total);
    const only = buckets.size === 1 ? [...buckets][0] : undefined;
    if (!only) return { amount: null, currency: freightCurrency, rate: logisticsRate(freightCurrency) };
    const [totalCurrency, total] = only;
    return { amount: Math.round(total * 1000) / 1000, currency: totalCurrency, rate: logisticsRate(totalCurrency) };
  }
  let amount = quoteMoneyValue(desk === "sourcing" ? notes.totalLabel : notes.shippingLabel);
  if (amount == null) amount = order?.lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0) ?? 0;
  return { amount, currency, rate: desk === "logistics" ? logisticsRate(currency) : currency === "VND" ? 1 : order?.rate ?? null };
}

/** Tổng báo giá quy về VND (chỉ để hiển thị/báo cáo, không in ra phiếu). Null khi thiếu tỷ giá hoặc số tiền chưa hợp lệ. */
export function quoteVndAmount(sheet: QuoteAmountSource | null | undefined, desk: "sourcing" | "logistics"): QuoteAmount & { vnd: number | null } {
  const total = quoteAmount(sheet, desk);
  const rate = total.currency === "VND" ? 1 : total.rate;
  const vnd = total.amount == null || !rate ? null : Math.round(total.amount * rate);
  return { ...total, vnd };
}

export function shippingInCurrency(sheet: QuoteAmountSource | null | undefined, target: { currency: string; rate: number | null }): number | null {
  const shipping = quoteAmount(sheet, "logistics");
  if (shipping.amount === 0 || shipping.currency === target.currency) return shipping.amount;
  const fromRate = shipping.currency === "VND" ? 1 : shipping.rate;
  const toRate = target.currency === "VND" ? 1 : target.rate;
  if (shipping.amount == null || !fromRate || !toRate) return null;
  return Math.round(shipping.amount * fromRate / toRate * 100) / 100;
}

/** Dùng bản nháp/bản đã gửi do caller chọn; không đổi loại tiền hay giá của báo giá. */
export function quotePaymentSummary(sheet: Omit<QuoteAmountSource, "sentQuote">) {
  const payment = sheet.notes.payment;
  if (!payment) return null;
  const total = quoteAmount({ orders: sheet.orders, notes: sheet.notes, shippingMode: sheet.shippingMode, logisticsClass: sheet.logisticsClass }, "logistics");
  const rate = payment.currency === payment.quoteCurrency ? 1 : payment.exchangeRate;
  let error = total.amount == null || total.currency !== payment.quoteCurrency
    ? "Các khoản phí phải có số tiền hợp lệ và cùng loại tiền báo giá trước khi quy đổi thanh toán"
    : !rate || !Number.isFinite(rate) || rate <= 0 ? "Nhập tỷ giá thanh toán lớn hơn 0" : "";
  const converted = error ? null : total.amount! * rate!;
  if (converted != null && (!Number.isFinite(converted) || converted > Number.MAX_SAFE_INTEGER)) error = "Số tiền quy đổi vượt giới hạn cho phép";
  const digits = payment.currency === "VND" || payment.currency === "JPY" ? 0 : 2;
  return { ...payment, total: total.amount, rate, amount: error || converted == null ? null : Math.round(converted * 10 ** digits) / 10 ** digits, error };
}
