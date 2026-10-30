"use client";

import { quotePrintCss } from "./quote-print";

/** Xem trước sheet báo giá đúng layout in/PDF (logo + tông SpeeGo). */
export function QuoteSheetPreview({ html, title = "Xem trước báo giá" }: { html: string; title?: string }) {
  return (
    <iframe
      title={title}
      className="h-[min(70vh,720px)] w-full rounded-lg border border-[#c5d0de] bg-white"
      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${quotePrintCss}
        html, body, table, th, td, p, strong, span, h1, h2, div {
          font-family: "Times New Roman", Times, "Liberation Serif", serif !important;
        }
        body { padding: 12px; background: #fff; }
        @page { size: A4 landscape; margin: 10mm 12mm; }
      </style></head><body><div class="sheet-wrap">${html}</div></body></html>`}
    />
  );
}
