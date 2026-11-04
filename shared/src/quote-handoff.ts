import { quoteLineImages, type QuoteLine, type QuoteOrder } from "./crm";

/** Carry product information across desks; transport pricing is entered independently. */
export function logisticsOrderFromSourcing(order: QuoteOrder): QuoteOrder {
  return {
    ...order,
    selected: true,
    lines: order.lines.map((line) => ({ ...line, pricePerSet: null, lineTotal: null, prices: [], basis: "unit" })),
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
