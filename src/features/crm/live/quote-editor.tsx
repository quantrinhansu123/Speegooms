"use client";

import { Fragment, useState } from "react";
import { Download, Eye, ImagePlus, Pencil, Plus, Printer, RotateCcw, Send, Trash2 } from "lucide-react";
import {
  quoteCurrencies,
  quoteOrderSchema,
  updateQuoteSchema,
  type CrmLane,
  type QuoteBank,
  type QuoteCurrency,
  type QuoteLine,
  type QuoteNotes,
  type QuoteOrder,
  type UpdateQuoteInput,
} from "@speego/shared";
import { ContractCreateDialog } from "./contract-create-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contractStatusOptions, quoteStatusOptions, type QuoteRecord, type QuoteTemplateRecord } from "./types";
import { lineAmount, packageMetrics, pricingBasisLabels, type PricingBasis } from "@/services/crm/quote-lines";
import { downloadQuotePdf, printQuoteSheet, quoteSheetHtml, quoteTotals } from "./quote-print";
import { QuoteSheetPreview } from "./quote-sheet-preview";

function emptyLine(stt: string): QuoteLine {
  return { stt, image: "", quantity: null, pricePerSet: null, lineTotal: null, weightKg: null, spec: "", note: "", unit: "set", basis: "unit", cbm: null, packages: [], attrs: [] };
}

function amountValue(value: string): number | null {
  const trimmed = value.trim().replaceAll(",", "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function amountText(value: number | null): string {
  return value == null ? "" : String(value);
}

function filledLine(line: QuoteLine): boolean {
  return Boolean(line.stt || line.image || line.quantity != null || line.pricePerSet != null || line.lineTotal != null || line.weightKg != null || line.spec || line.note || line.packages.length > 0);
}

function packagesSummary(packages: QuoteLine["packages"]): string {
  const m = packageMetrics(packages);
  return `${m.count} kiện · ${m.cbm} cbm · tính cước ${m.chargeableKg} kg`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function safeImage(value: string): string {
  if (value.startsWith("data:image/") || value.startsWith("https://")) return value;
  return "";
}

function clipboardImage(event: React.ClipboardEvent): File | string | null {
  const items = event.clipboardData?.items;
  if (items) {
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
  if (text.startsWith("data:image/") || /^https:\/\/\S+$/.test(text)) return text;
  return null;
}

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không đọc được ảnh");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.72);
  if (url.length > 90_000) throw new Error("Ảnh quá lớn, hãy chọn ảnh nhỏ hơn");
  return url;
}

function OrderLines({
  lines,
  currency,
  canEdit,
  onChange,
  onError,
}: {
  lines: QuoteLine[];
  currency: QuoteCurrency;
  canEdit: boolean;
  onChange: (lines: QuoteLine[]) => void;
  onError: (message: string) => void;
}) {
  const updateLine = (index: number, patch: Partial<QuoteLine>) => {
    onChange(lines.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      let next = { ...line, ...patch };
      // Có kiện thì CBM và cân tính cước suy ra từ kiện
      if ("packages" in patch && next.packages.length > 0) {
        const m = packageMetrics(next.packages);
        next = { ...next, cbm: m.cbm, weightKg: m.chargeableKg };
      }
      // Đổi số lượng, giá, cách tính hoặc kiện thì tự tính lại thành tiền; vẫn sửa tay được sau đó
      if (["quantity", "pricePerSet", "basis", "packages", "weightKg", "cbm"].some((k) => k in patch)) {
        const total = lineAmount({ basis: next.basis, quantity: next.quantity, price: next.pricePerSet, weightKg: next.weightKg, cbm: next.cbm });
        if (total != null) next = { ...next, lineTotal: total };
      }
      return next;
    }));
  };

  const addLine = () => {
    const numbers = lines.map((line) => Number(line.stt)).filter((value) => Number.isFinite(value) && value > 0);
    const next = numbers.length ? Math.max(...numbers) + 1 : lines.length + 1;
    onChange([...lines, emptyLine(String(next))]);
  };

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1080px] text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-2 py-2 font-medium">STT</th>
              <th className="px-2 py-2 font-medium">Hình ảnh</th>
              <th className="px-2 py-2 font-medium">Số lượng / đơn vị</th>
              <th className="px-2 py-2 font-medium">Đơn giá ({currency}) / cách tính</th>
              <th className="px-2 py-2 font-medium">Tổng tiền hàng ({currency})</th>
              <th className="px-2 py-2 font-medium">Cân nặng (KG)</th>
              <th className="px-2 py-2 font-medium">Thông số</th>
              <th className="px-2 py-2 font-medium">Note</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <Fragment key={index}>
              <tr className={`align-top ${line.packages.length || line.attrs.length || canEdit ? "" : "border-b last:border-0"}`}>
                <td className="px-2 py-2"><Input className="h-8 w-14" value={line.stt} disabled={!canEdit} onChange={(event) => updateLine(index, { stt: event.target.value })} /></td>
                <td className="px-2 py-2">
                  <div
                    tabIndex={canEdit ? 0 : undefined}
                    className="flex w-28 flex-col gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Ảnh dòng ${index + 1}`}
                    onCopy={(event) => {
                      const image = safeImage(line.image);
                      if (!image || !event.clipboardData) return;
                      event.preventDefault();
                      event.clipboardData.setData("text/plain", image);
                    }}
                    onPaste={(event) => {
                      if (!canEdit) return;
                      const pasted = clipboardImage(event);
                      if (!pasted) return;
                      event.preventDefault();
                      if (typeof pasted === "string") {
                        if (pasted.length > 90_000) {
                          onError("Ảnh quá lớn, hãy chọn ảnh nhỏ hơn");
                          return;
                        }
                        updateLine(index, { image: pasted });
                        return;
                      }
                      void compressImage(pasted)
                        .then((image) => updateLine(index, { image }))
                        .catch((err: unknown) => onError(err instanceof Error ? err.message : "Không đọc được ảnh"));
                    }}
                  >
                    {safeImage(line.image) && <img src={safeImage(line.image)} alt="" className="h-16 w-16 rounded object-contain" />}
                    {canEdit && (
                      <>
                        <label className="inline-flex h-7 w-fit cursor-pointer items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
                          <ImagePlus aria-hidden className="size-3.5" />
                          {line.image ? "Đổi ảnh" : "Thêm ảnh"}
                          <input
                            className="sr-only"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            aria-label={`Tải ảnh dòng ${index + 1}`}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (!file) return;
                              void compressImage(file)
                                .then((image) => updateLine(index, { image }))
                                .catch((err: unknown) => onError(err instanceof Error ? err.message : "Không đọc được ảnh"));
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-muted-foreground">hoặc Ctrl+V</p>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="grid w-24 gap-1">
                    <Input className="h-8" inputMode="decimal" aria-label={`Số lượng dòng ${index + 1}`} value={amountText(line.quantity)} disabled={!canEdit} onChange={(event) => updateLine(index, { quantity: amountValue(event.target.value) })} />
                    <Input className="h-8" aria-label={`Đơn vị dòng ${index + 1}`} value={line.unit} disabled={!canEdit} onChange={(event) => updateLine(index, { unit: event.target.value })} />
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="grid w-36 gap-1">
                    <Input className="h-8" inputMode="decimal" aria-label={`Đơn giá dòng ${index + 1}`} value={amountText(line.pricePerSet)} disabled={!canEdit} onChange={(event) => updateLine(index, { pricePerSet: amountValue(event.target.value) })} />
                    <NativeSelect className="h-8 text-xs" aria-label={`Cách tính giá dòng ${index + 1}`} value={line.basis} disabled={!canEdit} onChange={(event) => updateLine(index, { basis: event.target.value as PricingBasis })}>
                      {(Object.keys(pricingBasisLabels) as PricingBasis[]).map((b) => <option key={b} value={b}>{pricingBasisLabels[b]}</option>)}
                    </NativeSelect>
                  </div>
                </td>
                <td className="px-2 py-2"><Input className="h-8 w-24" inputMode="decimal" value={amountText(line.lineTotal)} disabled={!canEdit} onChange={(event) => updateLine(index, { lineTotal: amountValue(event.target.value) })} /></td>
                <td className="px-2 py-2"><Input className="h-8 w-20" inputMode="decimal" value={amountText(line.weightKg)} disabled={!canEdit} onChange={(event) => updateLine(index, { weightKg: amountValue(event.target.value) })} /></td>
                <td className="px-2 py-2"><Textarea className="min-h-16 w-44" value={line.spec} disabled={!canEdit} onChange={(event) => updateLine(index, { spec: event.target.value })} /></td>
                <td className="px-2 py-2"><Textarea className="min-h-16 w-44" value={line.note} disabled={!canEdit} onChange={(event) => updateLine(index, { note: event.target.value })} /></td>
                <td className="px-2 py-2">
                  {canEdit && (
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Xóa dòng ${index + 1}`} onClick={() => onChange(lines.filter((_, lineIndex) => lineIndex !== index))}>
                      <Trash2 />
                    </Button>
                  )}
                </td>
              </tr>
              <tr className="border-b bg-muted/20 last:border-0">
                <td />
                <td colSpan={8} className="px-2 py-2">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="grid gap-1.5">
                      <p className="font-medium">Quy cách đóng gói{line.packages.length > 0 && ` · ${packagesSummary(line.packages)}`}</p>
                      {line.packages.map((pkg, pi) => (
                        <div key={pi} className="flex flex-wrap items-center gap-1">
                          {(["count", "lengthCm", "widthCm", "heightCm", "actualKg"] as const).map((key) => (
                            <Input
                              key={key}
                              className="h-7 w-16"
                              inputMode="decimal"
                              placeholder={{ count: "Số kiện", lengthCm: "D cm", widthCm: "R cm", heightCm: "C cm", actualKg: "kg/kiện" }[key]}
                              aria-label={`Kiện ${pi + 1} dòng ${index + 1}: ${key}`}
                              value={pkg[key] ? String(pkg[key]) : ""}
                              disabled={!canEdit}
                              onChange={(event) => updateLine(index, { packages: line.packages.map((x, xi) => (xi === pi ? { ...x, [key]: amountValue(event.target.value) ?? 0 } : x)) })}
                            />
                          ))}
                          {canEdit && <Button type="button" size="icon-sm" variant="ghost" aria-label={`Xóa kiện ${pi + 1}`} onClick={() => updateLine(index, { packages: line.packages.filter((_, xi) => xi !== pi) })}><Trash2 /></Button>}
                        </div>
                      ))}
                      {canEdit && <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => updateLine(index, { packages: [...line.packages, { count: 1, lengthCm: 0, widthCm: 0, heightCm: 0, actualKg: 0 }] })}><Plus />Thêm kiện</Button>}
                    </div>
                    <div className="grid gap-1.5">
                      <p className="font-medium">Thuộc tính (chất liệu, bảo hành, thời gian sản xuất…)</p>
                      {line.attrs.map((attr, ai) => (
                        <div key={ai} className="flex items-center gap-1">
                          <Input className="h-7 w-32" placeholder="Tên" aria-label={`Thuộc tính ${ai + 1} dòng ${index + 1}: tên`} value={attr.key} disabled={!canEdit} onChange={(event) => updateLine(index, { attrs: line.attrs.map((x, xi) => (xi === ai ? { ...x, key: event.target.value } : x)) })} />
                          <Input className="h-7" placeholder="Giá trị" aria-label={`Thuộc tính ${ai + 1} dòng ${index + 1}: giá trị`} value={attr.value} disabled={!canEdit} onChange={(event) => updateLine(index, { attrs: line.attrs.map((x, xi) => (xi === ai ? { ...x, value: event.target.value } : x)) })} />
                          {canEdit && <Button type="button" size="icon-sm" variant="ghost" aria-label={`Xóa thuộc tính ${ai + 1}`} onClick={() => updateLine(index, { attrs: line.attrs.filter((_, xi) => xi !== ai) })}><Trash2 /></Button>}
                        </div>
                      ))}
                      {canEdit && <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => updateLine(index, { attrs: [...line.attrs, { key: "", value: "" }] })}><Plus />Thêm thuộc tính</Button>}
                    </div>
                  </div>
                </td>
              </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && <Button type="button" variant="outline" onClick={addLine}><Plus />Thêm dòng</Button>}
    </div>
  );
}

export function QuoteEditor({
  quote,
  templates,
  canEdit,
  pending,
  error,
  onClose,
  onSave,
  onSend,
  onReturn,
  embedded = false,
  heading,
  allowContract = false,
  lane,
  onContractCreated,
}: {
  quote: QuoteRecord;
  templates: QuoteTemplateRecord[];
  canEdit: boolean;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSave: (input: UpdateQuoteInput, options?: { close?: boolean }) => Promise<boolean>;
  onSend?: (input: UpdateQuoteInput) => Promise<string | null>;
  onReturn?: () => Promise<string | null>;
  embedded?: boolean;
  heading?: string;
  allowContract?: boolean;
  lane?: CrmLane;
  onContractCreated?: () => void;
}) {
  const [templateId, setTemplateId] = useState(quote.templateId ?? "");
  const [opsNote, setOpsNote] = useState(quote.opsNote ?? "");
  const [quoteStatus, setQuoteStatus] = useState<(typeof quoteStatusOptions)[number][0]>(
    quoteStatusOptions.some((item) => item[0] === quote.quoteStatus) ? quote.quoteStatus as (typeof quoteStatusOptions)[number][0] : "CHUA_CO_BAO_GIA",
  );
  const [contractStatus, setContractStatus] = useState<(typeof contractStatusOptions)[number][0]>(
    contractStatusOptions.some((item) => item[0] === quote.contractStatus) ? quote.contractStatus as (typeof contractStatusOptions)[number][0] : "CHUA_TAO",
  );
  const [orders, setOrders] = useState<QuoteOrder[]>(quote.orders);
  const [notes, setNotes] = useState<QuoteNotes>({ ...quote.notes, shippingLabel: quote.notes.shippingLabel ?? "" });
  const [bank, setBank] = useState<QuoteBank>(quote.bank);
  const [formError, setFormError] = useState<string>();
  const [draft, setDraft] = useState<{ mode: "create" | "edit" | "view"; order: QuoteOrder } | null>(null);
  const [orderError, setOrderError] = useState<string>();
  const [removing, setRemoving] = useState<QuoteOrder | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);
  const sent = quoteStatus === "DA_CO_BAO_GIA" || quoteStatus === "DA_CO_BAO_GIA_LAI";
  const needsNewQuote = quoteStatus === "CHUA_CO_BAO_GIA_LAI";
  const fieldId = (name: string) => (embedded ? `${quote.id}-${name}` : name);

  const payloadFor = (nextOrders: QuoteOrder[]): UpdateQuoteInput | null => {
    const parsed = updateQuoteSchema.safeParse({
      templateId: templateId || null,
      opsNote,
      quoteStatus,
      contractStatus,
      orders: nextOrders,
      notes,
      bank,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return null;
    }
    setFormError(undefined);
    return parsed.data;
  };

  const persist = async (nextOrders: QuoteOrder[], close: boolean) => {
    const data = payloadFor(nextOrders);
    if (!data) return false;
    const ok = await onSave(data, { close });
    if (ok) setOrders(nextOrders);
    return ok;
  };

  const save = () => {
    void persist(orders, true);
  };

  const sheetHtmlFor = (order: QuoteOrder) => quoteSheetHtml({
    customer: quote,
    lines: order.lines,
    currency: order.currency,
    rate: order.rate,
    notes,
    bank,
    code: quote.code,
    orderName: order.name,
    issuedOn: quote.createdAt
      ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(quote.createdAt))
      : undefined,
  });

  const pdfNameFor = (order: QuoteOrder) => `${quote.code || "bao-gia"}${order.name ? `-${order.name}` : ""}`;

  const printOrder = (order: QuoteOrder) => {
    void printQuoteSheet(sheetHtmlFor(order));
  };

  const downloadOrderPdf = async (order: QuoteOrder) => {
    setPdfPending(true);
    setFormError(undefined);
    try {
      await downloadQuotePdf(sheetHtmlFor(order), pdfNameFor(order));
    } catch {
      setFormError("Không tải được PDF báo giá");
    } finally {
      setPdfPending(false);
    }
  };

  const printSelected = () => {
    const selected = orders.filter((order) => order.selected);
    const targets = selected.length > 0 ? selected : orders;
    if (targets.length === 0) {
      setFormError("Chưa có mẫu báo giá để in");
      return;
    }
    setFormError(undefined);
    void printQuoteSheet(targets.map((order) => sheetHtmlFor(order)));
  };

  const downloadSelectedPdf = () => {
    const selected = orders.find((order) => order.selected) ?? orders[0];
    if (!selected) {
      setFormError("Chưa có mẫu báo giá để tải PDF");
      return;
    }
    setFormError(undefined);
    void downloadOrderPdf(selected);
  };

  const openCreate = () => {
    setOrderError(undefined);
    setDraft({
      mode: "create",
      order: {
        id: crypto.randomUUID(),
        name: "",
        selected: orders.every((order) => !order.selected),
        currency: "VND",
        rate: null,
        lines: [emptyLine("1")],
      },
    });
  };

  const saveDraft = async () => {
    if (!draft || draft.mode === "view") return;
    const parsed = quoteOrderSchema.safeParse({
      ...draft.order,
      lines: draft.order.lines.filter(filledLine),
    });
    if (!parsed.success) {
      setOrderError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    if (parsed.data.lines.length === 0) {
      setOrderError("Nhập ít nhất một dòng hàng");
      return;
    }
    const next = draft.mode === "create"
      ? [...orders, parsed.data]
      : orders.map((order) => (order.id === parsed.data.id ? parsed.data : order));
    const ok = await persist(next, false);
    if (ok) setDraft(null);
  };

  const toggle = (id: string, checked: boolean) => {
    const next = orders.map((order) => ({
      ...order,
      selected: checked ? order.id === id : order.id === id ? false : order.selected,
    }));
    void persist(next, false);
  };

  const remove = () => {
    if (!removing) return;
    void persist(orders.filter((order) => order.id !== removing.id), false);
  };

  const actions = (
    <>
      <Button type="button" variant="outline" onClick={printSelected}><Printer />In</Button>
      <Button type="button" variant="outline" disabled={pdfPending} onClick={downloadSelectedPdf}>
        <Download />{pdfPending ? "Đang tải…" : "Tải PDF"}
      </Button>
      {canEdit && onSend && <Button type="button" disabled={pending} onClick={() => setConfirmSend(true)}><Send />Gửi báo giá</Button>}
      {!canEdit && onReturn && sent && <Button type="button" disabled={pending} onClick={() => setConfirmReturn(true)}><RotateCcw />Gửi lại báo giá</Button>}
      {allowContract && !embedded && lane && contractStatus !== "DA_TAO" && (
        <Button type="button" variant="outline" onClick={() => setContractOpen(true)}>Chuyển Hợp đồng</Button>
      )}
      {!embedded && <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>}
      {canEdit && <Button type="button" disabled={pending} onClick={save}>{pending ? "Đang lưu…" : "Lưu"}</Button>}
    </>
  );

  const sheet = (
    <>
      <div className={embedded ? "grid gap-4" : "grid max-h-[68vh] gap-4 overflow-y-auto pr-1"}>
            {(formError || error) && <InlineAlert>{formError || error}</InlineAlert>}
            {needsNewQuote && canEdit && <InlineAlert>Sale đã gửi lại báo giá. Hãy tạo mẫu mới rồi bấm Gửi báo giá.</InlineAlert>}
            <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Khách hàng: </span>{quote.customerName || "—"}</p>
              <p><span className="text-muted-foreground">Công ty: </span>{quote.companyName || "—"}</p>
              <p><span className="text-muted-foreground">Địa chỉ: </span>{quote.address || "—"}</p>
              <p><span className="text-muted-foreground">SĐT: </span>{quote.phone || "—"}</p>
              <p className="sm:col-span-2"><span className="text-muted-foreground">Email: </span>{quote.email || "—"}</p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Thông tin đơn hàng</h3>
                {canEdit && <Button type="button" variant="outline" disabled={pending} onClick={openCreate}><Plus />Tạo thông tin đơn hàng</Button>}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-3 py-2 font-medium">Chọn</th>
                      <th className="px-3 py-2 font-medium">Tên mẫu</th>
                      <th className="px-3 py-2 font-medium">Số dòng</th>
                      <th className="px-3 py-2 font-medium">Tiền tệ</th>
                      <th className="px-3 py-2 font-medium">Tổng tiền hàng</th>
                      <th className="px-3 py-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Chưa có thông tin đơn hàng.</td></tr>
                    )}
                    {orders.map((order) => {
                      const totals = quoteTotals(order.lines);
                      return (
                        <tr key={order.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={order.selected}
                              disabled={!canEdit || pending}
                              aria-label={`Chọn ${order.name}`}
                              onChange={(event) => toggle(order.id, event.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{order.name}</td>
                          <td className="px-3 py-2">{order.lines.length}</td>
                          <td className="px-3 py-2">{order.currency}</td>
                          <td className="px-3 py-2">{totals.priced ? `${money(totals.goods)} ${order.currency}` : "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              <Button type="button" size="sm" variant="ghost" onClick={() => { setOrderError(undefined); setDraft({ mode: "view", order }); }}><Eye />Xem</Button>
                              {canEdit && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setOrderError(undefined); setDraft({ mode: "edit", order: { ...order, lines: order.lines.map((line) => ({ ...line })) } }); }}><Pencil />Sửa</Button>}
                              {canEdit && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setRemoving(order)}><Trash2 />Xóa</Button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tổng giá trị hàng hóa (Sourcing)" htmlFor={fieldId("note-total")}>
                <Input id={fieldId("note-total")} value={notes.totalLabel} disabled={!canEdit} onChange={(event) => setNotes({ ...notes, totalLabel: event.target.value })} placeholder="Tổng giá trị hàng hóa chưa bao gồm phí vận chuyển" />
              </Field>
              <Field label="Ghi chú cân nặng / CBM" htmlFor={fieldId("note-weight")}>
                <Input id={fieldId("note-weight")} value={notes.weightNote} disabled={!canEdit} onChange={(event) => setNotes({ ...notes, weightNote: event.target.value })} placeholder="Dự kiến số KG/CBM, có thể thay đổi theo thực tế" />
              </Field>
              <Field label="Tổng chi phí vận chuyển (Logistics)" htmlFor={fieldId("note-shipping")}>
                <Input id={fieldId("note-shipping")} value={notes.shippingLabel ?? ""} disabled={!canEdit} onChange={(event) => setNotes({ ...notes, shippingLabel: event.target.value })} placeholder="Tổng chi phí vận chuyển từ ..." />
              </Field>
              <Field label="Hiệu lực báo giá" htmlFor={fieldId("note-valid")}>
                <Input id={fieldId("note-valid")} value={notes.validityNote} disabled={!canEdit} onChange={(event) => setNotes({ ...notes, validityNote: event.target.value })} placeholder="Báo giá có hiệu lực kể từ ngày báo giá (...)" />
              </Field>
              <div className="grid gap-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Thông tin đặt cọc</span>
                  {canEdit && (
                    <Button type="button" variant="outline" size="sm" disabled={pending || notes.deposit.length >= 20} onClick={() => setNotes({ ...notes, deposit: [...notes.deposit, ""] })}>
                      <Plus />Thêm dòng
                    </Button>
                  )}
                </div>
                {notes.deposit.length === 0 && <p className="text-sm text-muted-foreground">Chưa có dòng đặt cọc.</p>}
                {notes.deposit.map((line, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      id={index === 0 ? fieldId("note-deposit") : undefined}
                      aria-label={`Thông tin đặt cọc ${index + 1}`}
                      value={line}
                      disabled={!canEdit}
                      onChange={(event) => setNotes({ ...notes, deposit: notes.deposit.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })}
                    />
                    {canEdit && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Xóa dòng đặt cọc ${index + 1}`} disabled={pending} onClick={() => setNotes({ ...notes, deposit: notes.deposit.filter((_, itemIndex) => itemIndex !== index) })}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <h3 className="mt-3 border-b pb-3 font-semibold sm:col-span-2">Thông tin thanh toán</h3>
              <Field label="Tài khoản" htmlFor={fieldId("bank-title")}>
                <Input id={fieldId("bank-title")} value={bank.title} disabled={!canEdit} onChange={(event) => setBank({ ...bank, title: event.target.value })} />
              </Field>
              <Field label="Account Name" htmlFor={fieldId("bank-name")}>
                <Input id={fieldId("bank-name")} value={bank.accountName} disabled={!canEdit} onChange={(event) => setBank({ ...bank, accountName: event.target.value })} />
              </Field>
              <Field label="Account Number" htmlFor={fieldId("bank-number")}>
                <Input id={fieldId("bank-number")} value={bank.accountNumber} disabled={!canEdit} onChange={(event) => setBank({ ...bank, accountNumber: event.target.value })} />
              </Field>
              <Field label="Routing Number" htmlFor={fieldId("bank-routing")}>
                <Input id={fieldId("bank-routing")} value={bank.routingNumber} disabled={!canEdit} onChange={(event) => setBank({ ...bank, routingNumber: event.target.value })} />
              </Field>
              <Field label="Mẫu báo giá" htmlFor={fieldId("quote-template")}>
                <NativeSelect id={fieldId("quote-template")} value={templateId} disabled={!canEdit} onChange={(event) => setTemplateId(event.target.value)}>
                  <option value="">Chưa chọn</option>
                  {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Ghi chú VH" htmlFor={fieldId("quote-note")}>
                <Input id={fieldId("quote-note")} value={opsNote} disabled={!canEdit} onChange={(event) => setOpsNote(event.target.value)} />
              </Field>
              <Field label="Trạng thái báo giá" htmlFor={fieldId("quote-status")}>
                <NativeSelect id={fieldId("quote-status")} value={quoteStatus} disabled={!canEdit} onChange={(event) => setQuoteStatus(event.target.value as (typeof quoteStatusOptions)[number][0])}>
                  {quoteStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Trạng thái hợp đồng" htmlFor={fieldId("quote-contract")}>
                <NativeSelect id={fieldId("quote-contract")} value={contractStatus} disabled={!canEdit} onChange={(event) => setContractStatus(event.target.value as (typeof contractStatusOptions)[number][0])}>
                  {contractStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
            </div>
          </div>
      {embedded ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : <DialogFooter>{actions}</DialogFooter>}
    </>
  );

  return (
    <>
      {embedded ? (
        <section className="grid gap-3 rounded-xl border p-3">
          <h3 className="font-medium">{heading ?? `Báo giá ${quote.code}`}</h3>
          {sheet}
        </section>
      ) : (
        <Dialog open onOpenChange={(open) => { if (!open && !draft) onClose(); }}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Báo giá {quote.code}</DialogTitle>
            </DialogHeader>
            {sheet}
          </DialogContent>
        </Dialog>
      )}

      {contractOpen && lane && (
        <ContractCreateDialog
          lane={lane}
          quote={quote}
          onClose={() => setContractOpen(false)}
          onCreated={() => {
            setContractStatus("DA_TAO");
            setContractOpen(false);
            onContractCreated?.();
          }}
        />
      )}

      {draft && (
        <Dialog open onOpenChange={(open) => { if (!open) setDraft(null); }}>
          <DialogContent className="z-[80] sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>
                {draft.mode === "create" ? "Tạo thông tin đơn hàng" : draft.mode === "edit" ? "Sửa thông tin đơn hàng" : "Xem thông tin đơn hàng"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[68vh] gap-4 overflow-y-auto pr-1">
              {orderError && <InlineAlert>{orderError}</InlineAlert>}
              <Field label="Tên thông tin đơn hàng" htmlFor={fieldId("order-name")}>
                <Input
                  id={fieldId("order-name")}
                  value={draft.order.name}
                  disabled={draft.mode === "view"}
                  onChange={(event) => setDraft({ ...draft, order: { ...draft.order, name: event.target.value } })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Loại tiền" htmlFor={fieldId("order-currency")} hint="VND là nội tệ, còn lại là ngoại tệ báo giá cho khách quốc tế">
                  <NativeSelect
                    id={fieldId("order-currency")}
                    value={draft.order.currency}
                    disabled={draft.mode === "view"}
                    onChange={(event) => {
                      const currency = event.target.value as QuoteCurrency;
                      setDraft({ ...draft, order: { ...draft.order, currency, rate: currency === "VND" ? null : draft.order.rate } });
                    }}
                  >
                    {quoteCurrencies.map((code) => <option key={code} value={code}>{code}{code === "VND" ? " (nội tệ)" : ""}</option>)}
                  </NativeSelect>
                </Field>
                {draft.order.currency !== "VND" && (
                  <Field label={`Tỷ giá (VND / 1 ${draft.order.currency})`} htmlFor={fieldId("order-rate")} hint="Không bắt buộc. Có tỷ giá thì báo giá in thêm dòng quy đổi VND">
                    <Input
                      id={fieldId("order-rate")}
                      inputMode="decimal"
                      value={amountText(draft.order.rate)}
                      disabled={draft.mode === "view"}
                      onChange={(event) => setDraft({ ...draft, order: { ...draft.order, rate: amountValue(event.target.value) } })}
                    />
                  </Field>
                )}
              </div>
              {draft.mode === "view" ? (
                <QuoteSheetPreview html={sheetHtmlFor(draft.order)} title={`Xem trước ${draft.order.name || quote.code}`} />
              ) : (
                <OrderLines
                  lines={draft.order.lines}
                  currency={draft.order.currency}
                  canEdit
                  onChange={(lines) => setDraft({ ...draft, order: { ...draft.order, lines } })}
                  onError={setOrderError}
                />
              )}
            </div>
            <DialogFooter>
              {draft.mode === "view" && (
                <>
                  <Button type="button" variant="outline" onClick={() => printOrder(draft.order)}><Printer />In</Button>
                  <Button type="button" variant="outline" disabled={pdfPending} onClick={() => void downloadOrderPdf(draft.order)}>
                    <Download />{pdfPending ? "Đang tải…" : "Tải PDF"}
                  </Button>
                </>
              )}
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>Đóng</Button>
              {draft.mode !== "view" && <Button type="button" disabled={pending} onClick={() => void saveDraft()}>{pending ? "Đang lưu…" : "Lưu"}</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Xóa thông tin đơn hàng"
        description={removing ? `Xóa mẫu “${removing.name}” khỏi báo giá này.` : ""}
        confirmLabel="Xóa"
        destructive
        onConfirm={remove}
      />
      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Gửi báo giá"
        description="Sale chỉ xem đúng bản đang chọn. Sửa đơn hàng sau khi gửi không đổi bản Sale đang xem."
        confirmLabel="Gửi"
        onConfirm={() => {
          if (!onSend) return;
          const data = payloadFor(orders);
          if (!data) return;
          void onSend(data).then((status) => {
            if (status && quoteStatusOptions.some((item) => item[0] === status)) {
              setQuoteStatus(status as (typeof quoteStatusOptions)[number][0]);
            }
          });
        }}
      />
      <ConfirmDialog
        open={confirmReturn}
        onOpenChange={setConfirmReturn}
        title="Gửi lại báo giá"
        description="Vận hành sẽ thấy yêu cầu này và tạo báo giá mới."
        confirmLabel="Gửi lại"
        onConfirm={() => {
          if (!onReturn) return;
          void onReturn().then((status) => {
            if (status && quoteStatusOptions.some((item) => item[0] === status)) {
              setQuoteStatus(status as (typeof quoteStatusOptions)[number][0]);
            }
          });
        }}
      />
    </>
  );
}
