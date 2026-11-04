"use client";

import { useState } from "react";
import type { QuoteRecord } from "./types";
import { InlineAlert } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildContractDoc, printContractPdf, type ContractDocFields } from "./contract-docx";

/** Ví dụ theo mẫu cho các ô vàng (Sale tự điền). */
const hints: Partial<Record<keyof ContractDocFields, string>> = {
  deposit: "30% hoặc $5,000",
  refundDays: "five (5)",
  sampleDays: "five (5)",
  longStopDays: "sixty (60)",
  inspectionDays: "three (3)",
  delivery: "delivery shall be made on a Delivered Duty Paid (DDP) basis to the Client's designated U.S. delivery location",
};

const labels: [keyof ContractDocFields, string][] = [
  ["clientName", "Tên pháp lý khách hàng"],
  ["entityType", "Loại hình (Corporation / LLC / Sole Proprietorship…)"],
  ["state", "Bang thành lập (State)"],
  ["address", "Địa chỉ trụ sở"],
  ["representative", "Người đại diện"],
  ["email", "Email"],
  ["phone", "Điện thoại"],
  ["deposit", "Tiền cọc (vd: 30% hoặc $5,000)"],
  ["refundDays", "Hoàn cọc nếu chưa đặt hàng sau (ngày)"],
  ["sampleDays", "Duyệt mẫu trong (ngày làm việc)"],
  ["longStopDays", "Long-stop giao hàng trễ (ngày)"],
  ["inspectionDays", "Kiểm hàng trong (ngày làm việc)"],
  ["delivery", "Điều khoản giao hàng"],
];

/** In file hợp đồng (.docx) của một hợp đồng đã tạo: ô xanh lấy từ báo giá, ô vàng Sale chỉnh. */
export function ContractDocDialog({
  code,
  quote,
  amounts,
  onClose,
}: {
  code: string;
  quote: QuoteRecord;
  amounts: { currency: string; productValue: number; shippingCost: number; totalValue: number };
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<ContractDocFields>({
    clientName: quote.companyName?.trim() || quote.customerName?.trim() || "",
    address: quote.address?.trim() ?? "",
    representative: quote.customerName?.trim() ?? "",
    email: quote.email?.trim() ?? "",
    phone: quote.phone?.trim() ?? "",
    entityType: "",
    state: "",
    deposit: "",
    refundDays: "",
    sampleDays: "",
    delivery: "",
    longStopDays: "",
    inspectionDays: "",
  });
  // Ô đã có dữ liệu từ báo giá (xanh) thì khóa; ô trống và ô vàng Sale tự nhập.
  const [locked] = useState(() => new Set(labels.map(([key]) => key).filter((key) => !(key in hints) && doc[key])));
  const [error, setError] = useState<string>();
  const download = async () => {
    try {
      const order = quote.sentQuote?.order ?? quote.orders.find((item) => item.selected) ?? quote.orders[0];
      const blob = await buildContractDoc(doc, { lines: order?.lines ?? [], ...amounts });
      await printContractPdf(blob, code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được file hợp đồng");
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="z-[80] max-h-[92dvh] sm:max-w-3xl">
        <DialogHeader><DialogTitle>In hợp đồng · {code}</DialogTitle></DialogHeader>
        <div className="grid max-h-[min(68vh,680px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {error && <div className="sm:col-span-2"><InlineAlert>{error}</InlineAlert></div>}
          {labels.map(([key, label]) => (
            <label key={key} className={`grid gap-1 text-xs text-muted-foreground ${key === "delivery" ? "sm:col-span-2" : ""}`}>
              {label}
              <Input placeholder={hints[key]} readOnly={locked.has(key)} title={locked.has(key) ? "Lấy từ báo giá, không sửa tại đây" : undefined} className={locked.has(key) ? "cursor-not-allowed bg-muted" : undefined} value={doc[key]} onChange={(event) => setDoc((current) => ({ ...current, [key]: event.target.value }))} />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
          <Button type="button" onClick={download}>Tải file PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
