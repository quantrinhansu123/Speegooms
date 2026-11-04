import type { QuoteLang } from "@speego/shared";
import { downloadQuoteRecordExcel } from "./quote-excel";
import type { QuoteOutputAction } from "./quote-language-dialog";
import { downloadQuoteRecordPdf, printQuoteRecord } from "./quote-print";
import type { QuotePdfSource } from "./quote-sheet";

/** Chạy một cách xuất (in, PDF, Excel) cho bản ghi báo giá theo ngôn ngữ đã chọn. */
export const quoteOutputRunners: Record<QuoteOutputAction, (source: QuotePdfSource, lang?: QuoteLang) => Promise<void>> = {
  print: printQuoteRecord,
  pdf: downloadQuoteRecordPdf,
  excel: downloadQuoteRecordExcel,
};
