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

/** Chỉ cộng phí cùng loại tiền của đơn. Có phí khác loại tiền thì không có tổng chung. */
function logisticsFeesTotal(fees: QuoteNotes["logisticsFees"], currency: string): number | null {
  let total = 0;
  for (const fee of fees) {
    if (fee.currency && fee.currency.toUpperCase() !== currency.toUpperCase()) return null;
    const amount = quoteMoneyValue(fee.value);
    if (amount == null) return null;
    total += amount;
  }
  return total;
}

export function quoteAmount(sheet: QuoteAmountSource | null | undefined, desk: "sourcing" | "logistics"): QuoteAmount {
  const order = sheet?.sentQuote?.order ?? sheet?.orders.find((item) => item.selected) ?? sheet?.orders[0];
  const notes = sheet?.sentQuote?.notes ?? sheet?.notes;
  const currency = order?.currency ?? "VND";
  if (!sheet || !notes) return { amount: 0, currency, rate: order?.rate ?? null };
  if (desk === "logistics" && (notes.freight.total != null || notes.logisticsFees.length > 0)) {
    const feeTotal = logisticsFeesTotal(notes.logisticsFees, currency);
    const freightCurrency = notes.freight.currency || currency;
    const amount = feeTotal == null || (notes.freight.total != null && freightCurrency !== currency)
      ? null : Math.round(((notes.freight.total ?? 0) + feeTotal) * 1000) / 1000;
    return { amount, currency, rate: order?.rate ?? null };
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
