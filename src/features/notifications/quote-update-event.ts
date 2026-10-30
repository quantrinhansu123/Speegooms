/**
 * Sự kiện báo giá được cập nhật (gửi, trả lại, yêu cầu).
 * Phát từ chuông khi `count` tăng → RFQ/báo giá nghe + refresh.
 */
export const QUOTE_UPDATE_EVENT = "speego:quote-updated";

export interface QuoteUpdateDetail {
  /** Loại sự kiện: quote.send, quote.request, quote.return */
  type: "quote.send" | "quote.request" | "quote.return" | string;
}

export function dispatchQuoteUpdate(detail: QuoteUpdateDetail) {
  window.dispatchEvent(new CustomEvent<QuoteUpdateDetail>(QUOTE_UPDATE_EVENT, { detail }));
}
