import { quoteLineImages, type QuoteLine, type QuoteNotes, type QuoteOrder } from "./crm";
import { resolvedFreightCurrency } from "./quote-amounts";

/** Hàng bảo hiểm thuần Logistics dùng cùng loại tiền và tỷ giá với cước; không đổi số giá đã nhập. */
export function withInsuranceCurrency(orders: QuoteOrder[], source: { customerKind: string | null; shippingMode?: string | null; logisticsClass?: string | null; notes: QuoteNotes }): QuoteOrder[] {
  if (source.customerKind !== "LOGISTICS") return orders;
  const selected = orders.find((order) => order.selected) ?? orders[0];
  const currency = source.shippingMode === "SEA" && source.logisticsClass === "FCL"
    ? source.notes.payment?.quoteCurrency ?? "USD"
    : resolvedFreightCurrency(source.notes, selected?.currency ?? "VND");
  return orders.map((order) => order.insurance === true ? {
    ...order, currency, rate: currency === "VND" ? null : source.notes.freight.vndRate ?? null,
    priceColumns: [],
  } : order);
}

/** Carry product information across desks; transport pricing is entered independently. */
export function logisticsOrderFromSourcing(order: QuoteOrder, previous?: QuoteOrder): QuoteOrder {
  return {
    ...order,
    selected: true,
    lines: order.lines.map((line) => {
      const price = previous?.id === order.id ? previous.lines.find((item) => item.stt === line.stt) : undefined;
      return { ...line, pricePerSet: price?.pricePerSet ?? null, lineTotal: price?.lineTotal ?? null,
        lineTotalManual: price?.lineTotalManual ?? false, prices: price?.prices ?? [], basis: price?.basis ?? "unit" };
    }),
  };
}

function lineHasContent(line: QuoteLine): boolean {
  return Boolean(
    line.stt.trim()
    || line.spec.trim()
    || line.note.trim()
    || line.quantity != null
    || line.packages.length > 0
    || quoteLineImages(line).length > 0,
  );
}

/** Đơn hàng có ít nhất một dòng hàng có thông tin thật. */
export function orderHasContent(order: Pick<QuoteOrder, "lines">): boolean {
  return order.lines.some(lineHasContent);
}

/**
 * Đơn hàng Sourcing chuyển sang Logistics: báo giá đã gửi, nếu chưa gửi thì mẫu đang chọn, rồi mẫu có thông tin đầu tiên.
 * Trả null khi Sourcing chưa nhập thông tin đơn hàng nào, lúc đó chưa được chuyển.
 */
export function sourcingHandoffOrder(quote: { sentQuote?: { order: QuoteOrder } | null; orders: QuoteOrder[] }): QuoteOrder | null {
  const candidates = quote.sentQuote ? [quote.sentQuote.order] : [...quote.orders.filter((order) => order.selected), ...quote.orders];
  return candidates.find(orderHasContent) ?? null;
}
