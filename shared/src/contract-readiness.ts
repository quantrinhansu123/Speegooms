import type { QuoteLine, QuoteOrder } from "./crm";
import { isCombinedSourcing, type QuoteWorkflow } from "./quote-workflow";

type SheetState = { quoteStatus: string; sentQuote: { order: QuoteOrder } | null } | null | undefined;

/** Báo giá của một bàn được tính là đã gửi: có bản đã gửi và không đang chờ báo giá lại. */
function sheetSent(sheet: SheetState): boolean {
  return Boolean(sheet?.sentQuote) && (sheet?.quoteStatus === "DA_CO_BAO_GIA" || sheet?.quoteStatus === "DA_CO_BAO_GIA_LAI");
}

function sheetProblem(label: string, sheet: SheetState): string | null {
  if (sheetSent(sheet)) return null;
  if (sheet?.quoteStatus === "CHUA_CO_BAO_GIA_LAI") return `${label} đang chờ báo giá lại`;
  return `chưa có báo giá ${label} đã gửi`;
}

/**
 * Điều kiện tạo hợp đồng: đủ các báo giá đã gửi.
 * - KH Logistics: báo giá Logistics.
 * - KH Sourcing luồng gộp: báo giá Sourcing và báo giá Logistics.
 * - KH Sourcing luồng cũ: báo giá Sourcing.
 * Đang chờ báo giá lại (Sale đã trả về) thì chưa đủ. Trả về danh sách lý do; rỗng là được tạo.
 */
export function contractQuoteProblems(quote: {
  customerKind: string | null;
  quoteWorkflow: QuoteWorkflow;
  quoteStatus: string;
  sentQuote: { order: QuoteOrder } | null;
  logisticsSheet?: SheetState;
}): string[] {
  if (quote.customerKind === "LOGISTICS") {
    return [sheetProblem("Logistics", quote)].filter((item): item is string => Boolean(item));
  }
  const problems = [sheetProblem("Sourcing", quote)];
  if (isCombinedSourcing(quote)) problems.push(sheetProblem("Logistics", quote.logisticsSheet));
  return problems.filter((item): item is string => Boolean(item));
}

export function contractQuoteMessage(problems: string[]): string {
  return `Chưa đủ báo giá để tạo hợp đồng: ${problems.join("; ")}.`;
}

/** Phần đơn hàng ảnh hưởng tới báo giá vận chuyển: mặt hàng, số lượng, quy cách, đóng gói, cân và thể tích. */
function lineShippingKey(line: QuoteLine) {
  return {
    productName: line.productName?.trim() ?? "",
    quantity: line.quantity,
    unit: line.unit,
    spec: line.spec.trim(),
    weightKg: line.weightKg,
    cbm: line.cbm,
    packages: line.packages,
  };
}

/** Đơn hàng đổi phần ảnh hưởng tới cước so với bản trước. */
export function orderShippingChanged(previous: QuoteOrder | null | undefined, next: QuoteOrder): boolean {
  if (!previous) return false;
  return JSON.stringify(previous.lines.map(lineShippingKey)) !== JSON.stringify(next.lines.map(lineShippingKey));
}
