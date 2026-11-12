import type { QuoteNotes, QuoteOrder, SentQuote } from "./crm";

type QuoteAmountSource = {
  orders: Pick<QuoteOrder, "currency" | "rate" | "priceColumns" | "lines" | "selected">[];
  notes: QuoteNotes;
  shippingMode?: "AIR" | "SEA" | null;
  logisticsClass?: string | null;
  sentQuote?: SentQuote | null;
};

/** Keep item pricing when changing basis, but do not add it on top of kg/CBM/lump freight. */
export function activeLogisticsFees(notes: Pick<QuoteNotes, "freight" | "logisticsFees">) {
  return notes.logisticsFees.filter(fee => notes.freight.basis === "item" || !fee.itemStt || (fee.rate === undefined && !fee.originalDetails));
}

type QuoteAmount = { amount: number | null; currency: string; rate: number | null; /** Dòng làm tổng logistics không cộng được. Chỉ có khi amount là null. */ gaps?: string[] };

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

/** Cước và giá gốc dùng chung loại tiền; giữ số tiền đã nhập và bỏ tỷ giá cũ. */
export function withFreightCurrency(notes: QuoteNotes, order: Pick<QuoteOrder, "currency" | "rate"> | undefined, currency: string): QuoteNotes {
  return {
    ...notes,
    freight: { ...notes.freight, currency, vndRate: currency === "VND" ? null : currency === order?.currency ? order.rate ?? null : null },
    logisticsFees: notes.logisticsFees.map(fee => (notes.freight.basis === "item" && fee.itemStt ? fee : { ...fee, currency: "" })),
    ...(notes.fcl ? { payment: { quoteCurrency: currency, currency: !notes.payment || notes.payment.currency === notes.payment.quoteCurrency ? currency : notes.payment.currency, exchangeRate: null } } : {}),
  };
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
  if (desk === "logistics" && (notes.freight.basis === "item" || notes.freight.total != null || notes.logisticsFees.length > 0)) {
    const freightCurrency = resolvedFreightCurrency(notes, currency);
    const buckets = new Map<string, number>();
    const named: { label: string; currency: string }[] = [];
    const gaps: string[] = [];
    for (const fee of activeLogisticsFees(notes)) {
      const raw = fee.value.trim();
      // Dòng phụ phí để trống (thường là dòng mặt hàng chưa nhập tiền) không tính. Chữ không phải số thì tổng chưa hợp lệ.
      if (!raw) continue;
      const label = fee.label.trim() || "Phụ phí";
      const feeAmount = quoteMoneyValue(raw);
      if (feeAmount == null) {
        gaps.push(`${label}: ${raw}`);
        continue;
      }
      // Phụ phí không ghi loại tiền thì theo loại tiền cước.
      const code = (fee.currency?.trim() || freightCurrency).toUpperCase();
      buckets.set(code, (buckets.get(code) ?? 0) + feeAmount);
      named.push({ label, currency: code });
    }
    if (notes.freight.basis !== "item" && notes.freight.total != null) {
      buckets.set(freightCurrency, (buckets.get(freightCurrency) ?? 0) + notes.freight.total);
      named.push({ label: "Cước", currency: freightCurrency });
    }
    if (notes.freight.basis === "item" && gaps.length === 0) {
      let vnd = 0;
      for (const fee of activeLogisticsFees(notes)) {
        if (!fee.value.trim()) continue;
        const code = fee.currency || freightCurrency;
        const rate = code === "VND" ? 1 : fee.vndRate !== undefined ? fee.vndRate : logisticsRate(code);
        if (!rate) return { amount: null, currency: freightCurrency, rate: logisticsRate(freightCurrency), gaps: [fee.label + ": thiếu tỷ giá"] };
        vnd += quoteMoneyValue(fee.value)! * rate;
      }
      const targetRate = logisticsRate(freightCurrency);
      return { amount: targetRate ? vnd / targetRate : null, currency: freightCurrency, rate: targetRate };
    }
    const only = buckets.size === 1 ? [...buckets][0] : undefined;
    if (gaps.length > 0 || !only) {
      const mixed = !only && named.length > 0 ? [`Không cùng loại tiền: ${named.map((line) => `${line.label} (${line.currency})`).join(", ")}`] : [];
      const missing = gaps.length === 0 && named.length === 0 ? ["Chưa có số tiền cước hoặc phụ phí"] : gaps;
      return { amount: null, currency: freightCurrency, rate: logisticsRate(freightCurrency), gaps: [...missing, ...mixed] };
    }
    const [totalCurrency, total] = only;
    return { amount: Math.round(total * 1000) / 1000, currency: totalCurrency, rate: logisticsRate(totalCurrency) };
  }
  let amount = quoteMoneyValue(desk === "sourcing" ? notes.totalLabel : notes.shippingLabel);
  if (amount == null) amount = order?.lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0) ?? 0;
  return { amount, currency, rate: desk === "logistics" ? logisticsRate(currency) : currency === "VND" ? 1 : order?.rate ?? null };
}

/** Kiểm tra bản nháp, không dùng tỷ giá từ bản đã gửi trước đó. */
export function quoteVndRateError(sheet: Omit<QuoteAmountSource, "sentQuote">, desk: "sourcing" | "logistics"): string | null {
  const order = sheet.orders.find(item => item.selected) ?? sheet.orders[0];
  const logisticsCurrency = sheet.shippingMode === "SEA" && sheet.logisticsClass === "FCL"
    ? sheet.notes.payment?.quoteCurrency ?? "USD" : resolvedFreightCurrency(sheet.notes, orderCurrencyOf(order));
  if (desk === "logistics" && sheet.notes.freight.basis === "item") {
    if (!order?.lines.length) return "Thêm mặt hàng trước khi báo giá theo mặt hàng";
    for (const [index, line] of order.lines.entries()) {
      const stt = line.stt.trim() || String(index + 1);
      const fee = sheet.notes.logisticsFees.find(fee => fee.itemStt === stt);
      if (!fee || fee.rate == null || fee.weightKg == null || quoteMoneyValue(fee.value) == null) return "Nhập đủ đơn giá, cân nặng và tổng tiền cước cho mặt hàng " + stt;
    }
  }
  const amounts = desk === "sourcing"
    ? sheet.orders.map(order => ({ currency: order.currency, rate: order.rate }))
    : [{ currency: logisticsCurrency, rate: sheet.notes.freight.vndRate },
      ...sheet.notes.logisticsFees.filter(fee => sheet.notes.freight.basis === "item" && fee.value.trim()).map(fee => ({ currency: fee.currency || logisticsCurrency, rate: fee.vndRate !== undefined ? fee.vndRate : (fee.currency || logisticsCurrency) === logisticsCurrency ? sheet.notes.freight.vndRate : null }))];
  const missing = amounts.find(({ currency, rate }) => currency !== "VND" && (rate == null || !Number.isFinite(rate) || rate <= 0));
  return missing ? `Nhập tỷ giá quy đổi VND lớn hơn 0 cho 1 ${missing.currency}` : null;
}

/** Ô trên báo giá còn trống khiến chưa quy được số tiền này về VND. */
function missingRatePlace(sheet: QuoteAmountSource | null | undefined, desk: "sourcing" | "logistics", currency: string): string {
  const notes = sheet?.sentQuote?.notes ?? sheet?.notes;
  const fcl = desk === "logistics" && sheet?.shippingMode === "SEA" && sheet?.logisticsClass === "FCL" && notes?.fcl;
  const where = desk === "sourcing" ? "Đơn hàng" : fcl ? "Bảng cước FCL" : "Chi phí vận chuyển";
  return `${where}, ô Quy đổi VND: 1 ${currency} =`;
}

/** Tổng báo giá quy về VND (chỉ để hiển thị/báo cáo, không in ra phiếu). Null khi thiếu tỷ giá hoặc số tiền chưa hợp lệ. */
export function quoteVndAmount(sheet: QuoteAmountSource | null | undefined, desk: "sourcing" | "logistics"): QuoteAmount & { vnd: number | null; rateGap?: string } {
  const total = quoteAmount(sheet, desk);
  const rate = total.currency === "VND" ? 1 : total.rate;
  const vnd = total.amount == null || !rate ? null : Math.round(total.amount * rate);
  const rateGap = total.amount != null && total.currency !== "VND" && !rate ? missingRatePlace(sheet, desk, total.currency) : undefined;
  return { ...total, vnd, rateGap };
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

/** Financials use the current draft on the operations desk; never silently count missing costs as zero. */
export function logisticsQuoteFinancials(sheet: Omit<QuoteAmountSource, "sentQuote">) {
  const revenue = sheet.notes.freight.basis === "item" && quoteVndRateError(sheet, "logistics") ? null : quoteVndAmount({ ...sheet, sentQuote: null }, "logistics").vnd;
  const order = sheet.orders.find(row => row.selected) ?? sheet.orders[0];
  const notes = sheet.notes;
  const currency = notes.fcl ? notes.payment?.quoteCurrency ?? "USD" : resolvedFreightCurrency(notes, order?.currency ?? "VND");
  const rows = notes.fcl ? notes.fcl.charges.map(row => ({ value: row.originalPrice == null || row.quantity == null ? null : row.originalPrice * row.quantity + row.vatAmount, currency, rate: notes.freight.vndRate })) : [
    ...(notes.freight.basis === "item" ? [] : [{ value: notes.freight.originalPrice, currency: notes.freight.originalDetails?.currency || currency, rate: notes.freight.originalDetails ? notes.freight.originalDetails.vndRate : notes.freight.vndRate }]),
    ...activeLogisticsFees(notes).filter(row => row.value.trim() || row.originalPrice != null).map(row => ({ value: row.originalPrice, currency: row.originalDetails?.currency || row.currency || currency, rate: row.originalDetails ? row.originalDetails.vndRate : row.vndRate !== undefined ? row.vndRate : (row.currency || currency) === currency ? notes.freight.vndRate : null })),
  ];
  const missingItem = notes.freight.basis === "item" && (!order?.lines.length || order.lines.some((line, index) => !notes.logisticsFees.some(fee => fee.itemStt === (line.stt.trim() || String(index + 1)) && fee.originalPrice != null)));
  const complete = !missingItem && rows.length > 0 && rows.every(row => row.value != null && (row.currency === "VND" || (row.rate != null && row.rate > 0)));
  const cost = complete ? Math.round(rows.reduce((sum, row) => sum + row.value! * (row.currency === "VND" ? 1 : row.rate!), 0)) : null;
  return { cost, revenue, profit: cost == null || revenue == null ? null : revenue - cost };
}
