import type { QuoteNotes, QuoteOrder, SentQuote } from "./crm";
import { quoteAmount } from "./quote-amounts";

export type MoneyAmount = { currency: string; amount: number };

/** Giá đã nhập trên báo giá, tách theo loại tiền. Không cộng qua tỷ giá. */
export type ContractAmounts = {
  product: MoneyAmount[];
  shipping: MoneyAmount[];
};

type AmountSheet = {
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
  const shipping = quoteAmount({ orders: sheet.orders ?? [], notes: sheet.notes, sentQuote: sheet.sentQuote }, "logistics");
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
