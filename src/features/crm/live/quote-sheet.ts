import { orderPackageMetrics, packagesText } from "@/services/crm/quote-lines";
import {
  buildQuoteSheetModel,
  isCombinedSourcing,
  quotePackageIssue,
  quoteShipmentMatches,
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
    freightMetrics: metrics.chargeableKg > 0 || metrics.cbm > 0 ? { chargeableKg: metrics.chargeableKg, cbm: metrics.cbm } : null,
  }, { packagesSpec: (line, lang) => packagesText(line.packages, lang, input.shippingMode) });
}

/** Bản ghi báo giá (danh sách, RFQ) đủ thông tin để in, tải PDF hoặc Excel. */
export type QuotePdfSource = QuoteSheetSource & { orders: QuoteOrder[] };

/** Mẫu đang chọn, hoặc mẫu đầu tiên. */
export function orderForQuotePdf(orders: QuoteOrder[]): QuoteOrder | undefined {
  return orders.find((order) => order.selected) ?? orders[0];
}

/** Lỗi cần xử lý trước khi xuất bản gửi khách, dùng chung cho editor và các danh sách. */
export function quoteOutputProblem(row: RfqQuoteRecord): string | null {
  if (!row.sentQuote) return "Chưa gửi báo giá. Hãy kiểm tra bản nháp và gửi báo giá trước khi In/PDF/Excel.";
  if (!["DA_CO_BAO_GIA", "DA_CO_BAO_GIA_LAI"].includes(row.quoteStatus)) return "Báo giá đang chờ xác nhận hoặc báo giá lại. Hãy gửi lại trước khi In/PDF/Excel.";
  const issue = quotePackageIssue(row.sentQuote.order);
  if (issue) return issue;
  if (row.desk !== "sourcing") return null;
  const logistics = row.logisticsSheet;
  if (!logistics?.sentQuote) return isCombinedSourcing(row) ? "Chưa có báo giá Logistics đã gửi. Cần Logistics xác nhận trước khi xuất báo giá gộp cho khách." : null;
  if (!["DA_CO_BAO_GIA", "DA_CO_BAO_GIA_LAI"].includes(logistics.quoteStatus)) return "Logistics đang chờ báo giá lại. Hãy xác nhận và gửi lại cước trước khi xuất báo giá gộp.";
  const logisticsIssue = quotePackageIssue(logistics.sentQuote.order);
  if (logisticsIssue) return logisticsIssue;
  if (!quoteShipmentMatches(row.sentQuote.order, logistics.sentQuote.order)) return "Hàng hóa, số lượng hoặc đóng gói giữa Sourcing và Logistics đã gửi chưa khớp. Cần hai bên xác nhận và gửi lại trước khi xuất báo giá gộp.";
  return null;
}

/** Chỉ xuất bản đã gửi; không ghép hàng đang sửa với cước đã gửi của phiên bản khác. */
export function printableRfqQuote(row: RfqQuoteRecord): RfqQuoteRecord | null {
  if (quoteOutputProblem(row) || !row.sentQuote) return null;
  const source = {
    ...row,
    issuedOn: new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(row.createdAt || row.sentQuote.sentAt)),
    orders: [{ ...row.sentQuote.order, selected: true }],
    notes: row.sentQuote.notes,
    bank: row.sentQuote.bank,
  };
  return quoteWithLogisticsCosts(source, row.desk === "sourcing" ? row.logisticsSheet?.sentQuote : null, source.orders[0]);
}

/** Gộp chi phí đã gửi để xuất cho khách; không đưa bản nháp Logistics vào báo giá. */
export function quoteWithLogisticsCosts<T extends QuoteSheetSource>(source: T, logistics: SentQuote | null | undefined, order: QuoteOrder): T {
  if (!logistics) return source;
  if (!quoteShipmentMatches(order, logistics.order)) throw new Error("Không thể ghép cước Logistics với hàng hóa hoặc đóng gói khác phiên bản.");
  const model = buildQuoteSheet(quoteSheetInputOf({ ...source, notes: logistics.notes, bank: logistics.bank }, logistics.order));
  return {
    ...source,
    notes: {
      ...source.notes,
      shippingLabel: logistics.notes.shippingLabel,
      shippingNotes: logistics.notes.shippingNotes,
      shippingNoteOther: logistics.notes.shippingNoteOther,
      // Phụ phí không ghi loại tiền thì theo loại tiền cước của bản Logistics.
      logisticsFees: logistics.notes.logisticsFees.map((fee) => ({ ...fee, currency: fee.currency || model.freight.currency })),
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
