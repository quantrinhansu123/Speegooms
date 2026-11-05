import { orderPackageMetrics, packagesText } from "@/services/crm/quote-lines";
import {
  buildQuoteSheetModel,
  quoteSheetInputOf,
  type QuoteLang,
  type QuoteOrder,
  type QuoteSheetInput,
  type QuoteSheetModel,
  type QuoteSheetSource,
  type SentQuote,
} from "@speego/shared";
import type { RfqQuoteRecord } from "./types";

/** Mô hình dữ liệu báo giá dùng chung cho bản in/PDF và Excel. Phần đóng gói cần công thức quy đổi kiện của frontend. */
export function buildQuoteSheet(input: QuoteSheetInput): QuoteSheetModel {
  const metrics = orderPackageMetrics(input.lines, input.shippingMode);
  return buildQuoteSheetModel({
    ...input,
    freightMetrics: metrics.count > 0 ? { chargeableKg: metrics.chargeableKg, cbm: metrics.cbm } : null,
  }, { packagesSpec: (line, lang) => packagesText(line.packages, lang, input.shippingMode) });
}

/** Bản ghi báo giá (danh sách, RFQ) đủ thông tin để in, tải PDF hoặc Excel. */
export type QuotePdfSource = QuoteSheetSource & { orders: QuoteOrder[] };

/** Mẫu đang chọn, hoặc mẫu đầu tiên. */
export function orderForQuotePdf(orders: QuoteOrder[]): QuoteOrder | undefined {
  return orders.find((order) => order.selected) ?? orders[0];
}

/** Ưu tiên bản đã gửi cho Sale; không có thì lấy mẫu đơn hàng hiện có để xem/in. */
export function printableRfqQuote(row: RfqQuoteRecord): RfqQuoteRecord | null {
  const source = row.sentQuote
    ? {
      ...row,
      orders: [{ ...row.sentQuote.order, selected: true }],
      notes: row.sentQuote.notes,
      bank: row.sentQuote.bank,
    }
    : orderForQuotePdf(row.orders) ? row : null;
  return source ? quoteWithLogisticsCosts(source, row.desk === "sourcing" ? row.logisticsSheet?.sentQuote : null) : null;
}

/** Gộp chi phí đã gửi để xuất cho khách; không đưa bản nháp Logistics vào báo giá. */
export function quoteWithLogisticsCosts<T extends QuoteSheetSource>(source: T, logistics: SentQuote | null | undefined): T {
  if (!logistics) return source;
  const model = buildQuoteSheet(quoteSheetInputOf({ ...source, notes: logistics.notes, bank: logistics.bank }, logistics.order));
  return {
    ...source,
    notes: {
      ...source.notes,
      shippingLabel: logistics.notes.shippingLabel,
      logisticsFees: logistics.notes.logisticsFees.map((fee) => ({ ...fee, currency: fee.currency || logistics.order.currency })),
      // Giữ tổng từ kiện của bản Logistics đã gửi khi in cùng hàng hóa Sourcing.
      freight: { ...logistics.notes.freight, total: model.freight.total ?? (model.feeSubtotals.length === 0 ? model.shippingAmount : null), totalManual: true, currency: model.freight.currency },
      ...(logistics.notes.payment ? { payment: logistics.notes.payment } : {}),
    },
    bank: logistics.notes.payment ? logistics.bank : source.bank,
  };
}

/** Các ô chữ chưa có bản tiếng Anh của mẫu đang chọn (rỗng khi in tiếng Việt). */
export function quoteRecordMissing(quote: QuotePdfSource, lang: QuoteLang): string[] {
  const order = orderForQuotePdf(quote.orders);
  if (lang !== "en" || !order) return [];
  return buildQuoteSheet(quoteSheetInputOf(quote, order, lang)).missing;
}
