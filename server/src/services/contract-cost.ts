import { logisticsQuoteFinancials } from "@speego/shared";
import type { QuoteRecord } from "../repositories/crm.repository";

type Cost = { label: string; currency: string; amount: number };

/** Giá gốc phải trả agent theo báo giá gắn với hợp đồng. Thiếu giá gốc thì bỏ dòng, không tính bằng 0. Chỉ Kế toán xem, không in. */
export function contractAgentCost(quote: QuoteRecord | null): Cost[] {
  if (!quote) return [];
  const costs: Cost[] = [];
  const order = quote.orders.find(row => row.selected) ?? quote.orders[0];
  const items = order?.lines.flatMap(line => {
    if (line.originalPrice == null) return [];
    const metric = line.basis === "kg" ? line.weightKg : line.basis === "m2" ? line.areaM2 : line.basis === "cbm" ? line.cbm : 1;
    const amount = line.basis === "lump" ? line.originalPrice : line.quantity == null || metric == null ? null : line.quantity * metric * line.originalPrice;
    return amount == null ? [] : [amount];
  }) ?? [];
  if (order && items.length) costs.push({ label: "Giá gốc hàng", currency: order.currency, amount: Math.round(items.reduce((a, b) => a + b, 0) * 1000) / 1000 });
  const sheet = quote.customerKind === "LOGISTICS" ? quote : quote.logisticsSheet;
  const logistics = sheet && logisticsQuoteFinancials(sheet).cost;
  if (logistics != null) costs.push({ label: "Giá gốc vận chuyển", currency: "VND", amount: logistics });
  return costs;
}
