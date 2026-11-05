import type { QuoteNotes, QuoteOrder, SentQuote } from "./crm";

type QuoteAmountSource = {
  orders: QuoteOrder[];
  notes: QuoteNotes;
  sentQuote?: SentQuote | null;
};

type QuoteAmount = { amount: number | null; currency: string; rate: number | null };

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

function orderCurrencyOf(order: QuoteOrder | undefined): string {
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

function rateOf(order: QuoteOrder | undefined, currency: string): number | null {
  if (currency === "VND") return 1;
  if (order?.currency?.toUpperCase() === currency) return order.rate ?? null;
  return order?.priceColumns?.find((column) => column.currency.toUpperCase() === currency)?.rate ?? null;
}

export function quoteAmount(sheet: QuoteAmountSource | null | undefined, desk: "sourcing" | "logistics"): QuoteAmount {
  const order = sheet?.sentQuote?.order ?? sheet?.orders.find((item) => item.selected) ?? sheet?.orders[0];
  const notes = sheet?.sentQuote?.notes ?? sheet?.notes;
  const currency = orderCurrencyOf(order);
  if (!sheet || !notes) return { amount: 0, currency, rate: order?.rate ?? null };
  if (desk === "logistics" && (notes.freight.total != null || notes.logisticsFees.length > 0)) {
    const freightCurrency = resolvedFreightCurrency(notes, currency);
    const buckets = new Map<string, number>();
    for (const fee of notes.logisticsFees) {
      const feeAmount = quoteMoneyValue(fee.value);
      if (feeAmount == null) return { amount: null, currency: freightCurrency, rate: rateOf(order, freightCurrency) };
      const code = (fee.currency?.trim() || currency).toUpperCase();
      buckets.set(code, (buckets.get(code) ?? 0) + feeAmount);
    }
    if (notes.freight.total != null) buckets.set(freightCurrency, (buckets.get(freightCurrency) ?? 0) + notes.freight.total);
    const only = buckets.size === 1 ? [...buckets][0] : undefined;
    if (!only) return { amount: null, currency: freightCurrency, rate: rateOf(order, freightCurrency) };
    const [totalCurrency, total] = only;
    return { amount: Math.round(total * 1000) / 1000, currency: totalCurrency, rate: rateOf(order, totalCurrency) };
  }
  let amount = quoteMoneyValue(desk === "sourcing" ? notes.totalLabel : notes.shippingLabel);
  if (amount == null) amount = order?.lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0) ?? 0;
  return { amount, currency, rate: order?.rate ?? null };
}

export function shippingInCurrency(sheet: QuoteAmountSource | null | undefined, target: { currency: string; rate: number | null }): number | null {
  const shipping = quoteAmount(sheet, "logistics");
  if (shipping.amount === 0 || shipping.currency === target.currency) return shipping.amount;
  const fromRate = shipping.currency === "VND" ? 1 : shipping.rate;
  const toRate = target.currency === "VND" ? 1 : target.rate;
  if (shipping.amount == null || !fromRate || !toRate) return null;
  return Math.round(shipping.amount * fromRate / toRate * 100) / 100;
}
