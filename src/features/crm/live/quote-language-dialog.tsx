"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { quoteLangLabels, quoteLangs, type QuoteLang } from "@speego/shared";
import { InlineAlert } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const quoteOutputActions = ["print", "pdf", "excel"] as const;
export type QuoteOutputAction = (typeof quoteOutputActions)[number];

/** Chữ hiển thị cho từng cách xuất: tiêu đề hộp thoại, nút xác nhận, mục menu, thông báo lỗi. */
export const quoteOutputText: Record<QuoteOutputAction, { title: string; confirm: string; menu: string; noSheet: string; failed: string }> = {
  print: { title: "In báo giá", confirm: "In", menu: "In báo giá", noSheet: "Chưa có mẫu báo giá để in", failed: "Không in được báo giá" },
  pdf: { title: "Tải PDF báo giá", confirm: "Tải PDF", menu: "Tải PDF", noSheet: "Chưa có mẫu báo giá để tải PDF", failed: "Không tải được PDF báo giá" },
  excel: { title: "Tải Excel báo giá", confirm: "Tải Excel", menu: "Tải Excel", noSheet: "Chưa có mẫu báo giá để xuất Excel", failed: "Không xuất được file Excel báo giá" },
};

export const quoteOutputIcon = { print: Printer, pdf: Download, excel: Download } as const;

/** Tải trước thư viện nặng của từng cách xuất trong lúc người dùng chọn ngôn ngữ. */
function preloadOutputLibraries(action: QuoteOutputAction) {
  if (action === "excel") void import("exceljs");
  if (action === "pdf") void Promise.all([import("html2canvas"), import("jspdf")]);
}

/**
 * Hộp thoại chọn ngôn ngữ (Tiếng Việt / English) trước khi in, tải PDF hoặc tải Excel.
 * `getMissing` cho biết các ô chữ chưa có bản tiếng Anh để cảnh báo khi chọn English.
 */
export function QuoteLanguageDialog({
  action,
  initial = "vi",
  getMissing,
  onConfirm,
  onClose,
}: {
  action: QuoteOutputAction;
  initial?: QuoteLang;
  getMissing?: (lang: QuoteLang) => string[];
  onConfirm: (lang: QuoteLang) => void;
  onClose: () => void;
}) {
  const [lang, setLang] = useState<QuoteLang>(initial);
  const text = quoteOutputText[action];
  const Icon = quoteOutputIcon[action];
  // Hộp thoại là modal nên dữ liệu bên dưới đứng yên: chỉ tính lại khi đổi ngôn ngữ.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const missing = useMemo(() => getMissing?.(lang) ?? [], [lang]);

  useEffect(() => preloadOutputLibraries(action), [action]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="z-[90] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend className="sr-only">Ngôn ngữ báo giá</legend>
          {quoteLangs.map((code) => (
            <label key={code} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm ${lang === code ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name="quote-output-lang" value={code} checked={lang === code} onChange={() => setLang(code)} className="size-4 accent-primary" />
              <span className="font-medium">{quoteLangLabels[code]}</span>
            </label>
          ))}
        </fieldset>
        {missing.length > 0 && (
          <InlineAlert tone="warning">
            {`Còn ${missing.length} ô chưa có tiếng Anh, sẽ để trống: ${missing.slice(0, 6).join("; ")}${missing.length > 6 ? "…" : ""}`}
          </InlineAlert>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="button" onClick={() => onConfirm(lang)}><Icon aria-hidden />{text.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
