import type { QuoteOrder } from "@speego/shared";

export function orderSummary(order: QuoteOrder | null) {
  const lines = order?.lines.filter((line) => line.productName?.trim()) ?? [];
  return {
    quantityNote: lines.map((line) => `${line.productName}: ${line.quantity ?? "?"} ${line.unit}`).join("; "),
  };
}
