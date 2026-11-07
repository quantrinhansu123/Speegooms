import type { QuoteNotes, QuoteOrder, SentQuote } from "./crm";
import { quoteAmount } from "./quote-amounts";

/** `converted`: số tiền đã quy đổi sang loại tiền chính của hợp đồng, chỉ có ở khoản khác loại tiền chính. */
export type MoneyAmount = { currency: string; amount: number; converted?: number };

/** Giá đã nhập trên báo giá, tách theo loại tiền. Không cộng qua tỷ giá. */
export type ContractAmounts = {
  product: MoneyAmount[];
  shipping: MoneyAmount[];
  /** Tỷ giá quy đổi VND theo từng loại tiền (số VND cho 1 đơn vị). */
  vndRates?: Record<string, number>;
};

type AmountSheet = {
  shippingMode?: "AIR" | "SEA" | null;
  logisticsClass?: string | null;
  orders?: QuoteOrder[];
  notes?: QuoteNotes;
  sentQuote?: SentQuote | null;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortMoney(lines: MoneyAmount[]): MoneyAmount[] {
  return [...lines].sort((left, right) => {
    if (left.currency === right.currency) return 0;
    if (left.currency === "VND") return -1;
    if (right.currency === "VND") return 1;
    return left.currency.localeCompare(right.currency);
  });
}

function selectedOrder(sheet: AmountSheet | null | undefined): QuoteOrder | undefined {
  return sheet?.sentQuote?.order ?? sheet?.orders?.find((item) => item.selected) ?? sheet?.orders?.[0];
}

/**
 * Thành tiền hàng đúng loại tiền chính của đơn (loại tiền các bên đã chọn ở báo giá).
 * Cột giá thêm là giá quy đổi theo tỷ giá nên không đưa vào hợp đồng, tránh hiểu nhầm có 2 loại tiền.
 */
export function productAmounts(order: QuoteOrder | null | undefined): MoneyAmount[] {
  if (!order) return [];
  const currency = (order.currency || "VND").toUpperCase();
  let seen = false;
  let total = 0;
  for (const line of order.lines) {
    if (line.lineTotal == null) continue;
    seen = true;
    total += line.lineTotal;
  }
  return seen ? [{ currency, amount: round2(total) }] : [];
}

/** Tổng logistics đúng loại tiền đã nhập. Null khi các khoản không cùng một loại tiền. */
export function shippingAmount(sheet: AmountSheet | null | undefined): MoneyAmount | null {
  if (!sheet?.notes) return null;
  const shipping = quoteAmount({ ...sheet, orders: sheet.orders ?? [], notes: sheet.notes }, "logistics");
  if (shipping.amount == null) return null;
  return { currency: shipping.currency, amount: shipping.amount };
}

export function sumByCurrency(groups: MoneyAmount[][]): MoneyAmount[] {
  const totals = new Map<string, number>();
  for (const group of groups) {
    for (const item of group) totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  }
  return sortMoney([...totals].map(([currency, amount]) => ({ currency, amount: round2(amount) })));
}

/** Tổng giá trị hợp đồng quy ra loại tiền chính. Khoản chưa có tỷ giá để quy đổi giữ riêng loại tiền của nó. */
export function totalsInMain(amounts: ContractAmounts, main: string): MoneyAmount[] {
  const totals = new Map<string, number>();
  for (const line of [...amounts.product, ...amounts.shipping]) {
    const inMain = line.currency === main ? line.amount : line.converted;
    const currency = inMain == null ? line.currency : main;
    totals.set(currency, (totals.get(currency) ?? 0) + (inMain ?? line.amount));
  }
  return sortMoney([...totals].map(([currency, amount]) => ({ currency, amount: round2(amount) })));
}

/** Quy từng lần nhận tiền theo tỷ giá thực tế; dòng cũ dùng tỷ giá của khoản đã quy đổi trên hợp đồng. */
export function paymentsInMain(paid: (MoneyAmount & { exchangeRate?: number | null })[], amounts: ContractAmounts, main: string): MoneyAmount[] {
  const rates = new Map<string, number>();
  for (const line of [...amounts.product, ...amounts.shipping]) {
    if (line.currency !== main && line.converted != null && line.amount > 0) rates.set(line.currency, line.converted / line.amount);
  }
  return paid.map((line) => {
    if (line.currency !== main && line.exchangeRate != null && line.exchangeRate > 0) {
      // HĐ tính bằng VND: tỷ giá là số VND cho 1 đơn vị loại tiền nhận; còn lại: số đơn vị loại tiền nhận cho 1 đơn vị tiền HĐ.
      return { currency: main, amount: round2(main === "VND" ? line.amount * line.exchangeRate : line.amount / line.exchangeRate) };
    }
    const rate = line.currency === main ? undefined : rates.get(line.currency);
    return rate ? { currency: main, amount: round2(line.amount * rate) } : { currency: line.currency, amount: line.amount };
  });
}

/** Trừ từng lần thanh toán khỏi đúng loại tiền của lần đó. */
export function remainderAfterPayments(totals: MoneyAmount[], paid: MoneyAmount[]): MoneyAmount[] {
  const paidTotals = sumByCurrency([paid]);
  const currencies = sortMoney([...totals, ...paidTotals].filter((item, index, all) => all.findIndex((other) => other.currency === item.currency) === index))
    .map((item) => item.currency);
  return currencies.map((currency) => ({
    currency,
    amount: round2((totals.find((item) => item.currency === currency)?.amount ?? 0) - (paidTotals.find((item) => item.currency === currency)?.amount ?? 0)),
  }));
}

/** Trừ một khoản thanh toán khỏi đúng loại tiền. Loại tiền khác giữ nguyên. */
export function remainderByCurrency(totals: MoneyAmount[], paidCurrency: string, paid: number): MoneyAmount[] {
  return remainderAfterPayments(totals, paid > 0 ? [{ currency: paidCurrency, amount: paid }] : []);
}

export function contractAmountsFromQuote(sourcing: AmountSheet | null | undefined, logistics: AmountSheet | null | undefined): ContractAmounts {
  const product = productAmounts(selectedOrder(sourcing));
  const shipping = shippingAmount(logistics);
  return { product, shipping: shipping ? [shipping] : [], vndRates: quoteVndRates(sourcing, logistics) };
}

/** Tỷ giá VND lấy từ báo giá: tỷ giá đơn hàng cho tiền hàng, tỷ giá phần logistics cho chi phí vận chuyển. */
export function quoteVndRates(sourcing: AmountSheet | null | undefined, logistics: AmountSheet | null | undefined): Record<string, number> {
  const rates: Record<string, number> = {};
  const order = selectedOrder(sourcing);
  const orderCurrency = (order?.currency || "VND").toUpperCase();
  if (orderCurrency !== "VND" && order?.rate) rates[orderCurrency] = order.rate;
  for (const column of order?.priceColumns ?? []) if (column.currency !== "VND" && column.rate && !rates[column.currency]) rates[column.currency] = column.rate;
  if (logistics?.notes) {
    const shipping = quoteAmount({ ...logistics, orders: logistics.orders ?? [], notes: logistics.notes }, "logistics");
    if (shipping.currency !== "VND" && shipping.rate) rates[shipping.currency] = shipping.rate;
  }
  return rates;
}

/** Tỷ giá quy đổi VND của hợp đồng: mã tiền → số VND cho 1 đơn vị. */
export type VndRates = Record<string, number>;

/**
 * Một lần thu tiền (thanh toán của Sale hoặc xác nhận của Kế toán).
 * `exchangeRate`: 1 đơn vị tiền hợp đồng = bao nhiêu đơn vị loại tiền nhận (HĐ USD, nhận VND: 25.500).
 * Hợp đồng tính bằng VND thì ngược lại: 1 đơn vị loại tiền nhận = bao nhiêu VND.
 */
export type ReceivedLine = { currency: string; amount: number; exchangeRate?: number | null };

/** Số VND cho 1 đơn vị loại tiền. VND = 1; chưa có tỷ giá trả null. */
export function vndRateOf(currency: string, rates: VndRates | null | undefined): number | null {
  if (currency === "VND") return 1;
  const rate = rates?.[currency];
  return rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Tổng một nhóm khoản quy về VND. Null khi có khoản ngoại tệ chưa có tỷ giá. */
export function linesInVnd(lines: MoneyAmount[], rates: VndRates | null | undefined): number | null {
  let total = 0;
  for (const line of lines) {
    const rate = vndRateOf(line.currency, rates);
    if (rate == null) return null;
    total += line.amount * rate;
  }
  return Math.round(total);
}

/** Một lần thu quy về loại tiền hợp đồng theo tỷ giá của chính lần đó. Null khi thiếu tỷ giá. */
export function receivedLineInMain(line: ReceivedLine, main: string): number | null {
  if (line.currency === main) return line.amount;
  const rate = line.exchangeRate;
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return round2(main === "VND" ? line.amount * rate : line.amount / rate);
}

/** Tổng các lần thu quy về loại tiền hợp đồng. Null khi có lần ngoại tệ thiếu tỷ giá. */
export function receivedInMain(lines: ReceivedLine[], main: string): number | null {
  let total = 0;
  for (const line of lines) {
    if (!(line.amount > 0)) continue;
    const value = receivedLineInMain(line, main);
    if (value == null) return null;
    total += value;
  }
  return round2(total);
}

/**
 * Số liệu hợp đồng theo VND để làm báo cáo: tổng Sourcing, Logistics, tổng giá trị, đã thu, còn lại.
 * Tính toán theo loại tiền hợp đồng: mỗi lần thu quy về tiền hợp đồng bằng tỷ giá của chính lần đó, còn lại = tổng - đã thu
 * (cùng loại tiền hợp đồng), rồi mới đổi sang VND theo tỷ giá của hợp đồng. Nên khách trả đủ thì còn lại đúng bằng 0
 * dù tỷ giá lúc trả khác lúc ký. Số "đã thu" hiển thị là số tiền thật nhận: lần trả bằng VND giữ nguyên số VND.
 * Null khi thiếu tỷ giá.
 */
export function contractVndSummary(amounts: ContractAmounts, paid: ReceivedLine[], main: string) {
  const rates = amounts.vndRates;
  const product = linesInVnd(amounts.product, rates);
  const shipping = linesInVnd(amounts.shipping, rates);
  const total = product == null || shipping == null ? null : product + shipping;
  const mainRate = vndRateOf(main, rates);
  const paidMain = receivedInMain(paid, main);
  let received: number | null = mainRate == null ? null : 0;
  for (const line of paid) {
    if (received == null) break;
    if (!(line.amount > 0)) continue;
    if (line.currency === "VND") { received += line.amount; continue; }
    const value = receivedLineInMain(line, main);
    received = value == null ? null : received + value * mainRate!;
  }
  if (received != null) received = Math.round(received);
  const totals = totalsInMain(amounts, main);
  const totalMain = totals.length === 1 && totals[0].currency === main ? totals[0].amount : null;
  const remaining = totalMain != null && paidMain != null && mainRate != null
    ? Math.round((totalMain - paidMain) * mainRate)
    : total == null || received == null ? null : total - received;
  /** Các loại tiền trên hợp đồng còn thiếu tỷ giá quy đổi VND. */
  const missing = [...new Set([...amounts.product, ...amounts.shipping].map((line) => line.currency))]
    .filter((currency) => vndRateOf(currency, rates) == null);
  return { product, shipping, total, received, remaining, missing };
}
