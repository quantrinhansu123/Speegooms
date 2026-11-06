import type { QuoteOrder } from "@speego/shared";

export function orderSummary(order: QuoteOrder | null) {
  const lines = order?.lines.filter((line) => line.productName?.trim()) ?? [];
  const packages = lines.flatMap((line) => line.packages);
  const weight = packages.length
    ? packages.reduce((total, item) => total + (item.actualKg ?? 0) * item.count, 0)
    : lines.reduce((total, line) => total + (line.weightKg ?? 0) * (line.quantity ?? 0), 0);
  return {
    quantityNote: lines.map((line) => `${line.productName}: ${line.quantity ?? "?"} ${line.unit}`).join("; "),
    packageDimensions: packages.map((item) => `${item.lengthCm} × ${item.widthCm} × ${item.heightCm} cm`).filter((value, index, all) => all.indexOf(value) === index).join("; "),
    weightKg: weight > 0 ? `${weight} kg` : "",
  };
}
