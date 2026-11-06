import type { QuoteNotes, QuoteOrder, SentQuote } from "./crm";
import { quoteAmount } from "./quote-amounts";

/** `converted`: số tiền đã quy đổi sang loại tiền chính của hợp đồng, chỉ có ở khoản khác loại tiền chính. */
export type MoneyAmount = { currency: string; amount: number; converted?: number };

/** Giá đã nhập trên báo giá, tách theo loại tiền. Không cộng qua tỷ giá. */
export type ContractAmounts = {
  product: MoneyAmount[];
  shipping: MoneyAmount[];
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
      return { currency: main, amount: round2(line.amount / line.exchangeRate) };
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
  return { product, shipping: shipping ? [shipping] : [] };
}
