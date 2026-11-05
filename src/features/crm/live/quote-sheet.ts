import { orderPackageMetrics, packagesText } from "@/services/crm/quote-lines";
import {
  buildQuoteSheetModel,
  quoteSheetInputOf,
  type QuoteLang,
  type QuoteOrder,
  type QuoteSheetInput,
  type QuoteSheetModel,
  type QuoteSheetSource,
} from "@speego/shared";

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

/** Các ô chữ chưa có bản tiếng Anh của mẫu đang chọn (rỗng khi in tiếng Việt). */
export function quoteRecordMissing(quote: QuotePdfSource, lang: QuoteLang): string[] {
  const order = orderForQuotePdf(quote.orders);
  if (lang !== "en" || !order) return [];
  return buildQuoteSheet(quoteSheetInputOf(quote, order, lang)).missing;
}
