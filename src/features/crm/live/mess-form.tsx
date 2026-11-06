"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Plus } from "lucide-react";
import { industryCategoryOptions, type IndustryCategory, type QuoteOrder } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { packageMetrics } from "@/services/crm/quote-lines";
import { MessOrderDialog } from "./quote-editor";
import { orderSummary } from "./order-summary";
import { brandOptions, careChannelOptions, customerTypeOptions, demandOptions, messageClassificationOptions, type MessageRecord } from "./types";

export const marketPresets = ["Mỹ", "Úc", "Canada", "Anh", "Đức", "Pháp", "Nhật", "Hàn", "Singapore", "Thái Lan"];

/** Trường của schema mess (create/update) → id ô trên form, để báo lỗi Zod đỏ đúng ô. */
export const messFieldIds: Record<string, string> = {
  receivedOn: "mess-date", customerName: "mess-name", market: "mess-market", classification: "mess-class",
  customerType: "mess-type", demand: "mess-demand", goods: "mess-goods", industry: "mess-industry",
  saleName: "mess-sale", painPoint: "mess-pain", linkMess: "mess-link", note: "mess-note",
  phone: "mess-phone", email: "mess-email", shippingMode: "lead-mode", logisticsClass: "lead-class",
};

/** Trường của schema chuyển khách tiềm năng → id ô trên form Tạo khách tiềm năng. */
export const leadConvertFieldIds: Record<string, string> = {
  phone: "mess-phone", brand: "lead-brand", customerType: "mess-type", careChannel: "lead-care",
  productInterest: "mess-goods", requirements: "mess-goods", quantityNote: "lead-quantity", address: "lead-address",
  saleNote: "mess-note", packageDimensions: "lead-dimensions", weightKg: "lead-weight", shipToAddress: "lead-ship-to",
  reason: "lead-reason", shippingMode: "lead-mode", logisticsClass: "lead-class",
};

export type Classification = "" | "HOT" | "WARM" | "COLD" | "DEAD";

export function uniqueSuggestions(values: Array<string | null | undefined>, presets: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of [...presets, ...values]) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export type MessDraft = {
  receivedOn: string;
  customerName: string;
  phone: string;
  email: string;
  market: string;
  classification: Classification;
  customerType: "" | "INDIVIDUAL" | "PRINCIPAL" | "ENTERPRISE";
  demand: "" | "SHIPPING" | "SOURCING";
  goods: string;
  industry: "" | IndustryCategory;
  saleName: string;
  painPoint: string;
  linkMess: string;
  note: string;
  /** Nháp thông tin sản phẩm/đơn hàng (Sale nhập; mess không bắt buộc, tạo khách tiềm năng thì bắt buộc). */
  order: QuoteOrder | null;
  /** Chỉ dùng khi tạo khách tiềm năng với Nhu cầu Vận chuyển: mess thường chọn lúc bấm Chuyển. */
  shippingMode: "" | "AIR" | "SEA";
  logisticsClass: "" | "LCL" | "FCL";
  brand: string;
  careChannel: string;
  quantityNote: string;
  address: string;
  packageDimensions: string;
  weightKg: string;
  shipToAddress: string;
  convertReason: string;
};

export const emptyDraft: MessDraft = {
  receivedOn: "",
  customerName: "",
  phone: "",
  email: "",
  market: "",
  classification: "",
  customerType: "",
  demand: "",
  goods: "",
  industry: "",
  saleName: "",
  painPoint: "",
  linkMess: "",
  note: "",
  order: null,
  shippingMode: "",
  logisticsClass: "",
  brand: "",
  careChannel: "",
  quantityNote: "",
  address: "",
  packageDimensions: "",
  weightKg: "",
  shipToAddress: "",
  convertReason: "",
};

export function todayInput(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

export function dateInputFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function isClassification(value: string | null): value is Exclude<Classification, ""> {
  return messageClassificationOptions.some((item) => item[0] === value);
}

function isIndustryCategory(value: string | null): value is IndustryCategory {
  return industryCategoryOptions.some(([option]) => option === value);
}

export function draftFrom(row: MessageRecord): MessDraft {
  return {
    receivedOn: dateInputFromIso(row.receivedAt),
    customerName: row.customerName ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    market: row.market ?? "",
    classification: isClassification(row.classification) ? row.classification : "",
    customerType: row.customerType === "INDIVIDUAL" || row.customerType === "PRINCIPAL" || row.customerType === "ENTERPRISE" ? row.customerType : "",
    demand: row.demand === "SHIPPING" || row.demand === "SOURCING" ? row.demand : "",
    goods: row.goods ?? "",
    industry: isIndustryCategory(row.industry) ? row.industry : "",
    saleName: row.saleName ?? "",
    painPoint: row.painPoint ?? "",
    linkMess: row.linkMess ?? "",
    note: row.note ?? "",
    order: row.order ?? null,
    shippingMode: "",
    logisticsClass: "",
    brand: "",
    careChannel: "",
    quantityNote: "",
    address: "",
    packageDimensions: "",
    weightKg: "",
    shipToAddress: "",
    convertReason: "",
  };
}

/** Tính lại cân và CBM mỗi đơn vị của từng dòng theo hệ số thể tích của đường bay (5000) hoặc đường biển (6000). */
export function withShippingMetrics(order: QuoteOrder, mode: "AIR" | "SEA"): QuoteOrder {
  return {
    ...order,
    lines: order.lines.map((line) => {
      if (line.packages.length === 0) return line;
      const metrics = packageMetrics(line.packages, mode);
      const quantity = line.quantity && line.quantity > 0 ? line.quantity : 1;
      return { ...line, cbm: metrics.cbm / quantity, weightKg: metrics.chargeableKg / quantity };
    }),
  };
}

/** Số dòng hàng đã nhập trong nháp đơn hàng. */
export function orderLineCount(order: QuoteOrder | null): number {
  return order ? order.lines.filter((line) => line.productName?.trim()).length : 0;
}

/**
 * Form Tạo/Sửa mess. `lead` = tạo khách tiềm năng trực tiếp: cùng các trường như mess nhưng không có Link mess,
 * Nhu cầu và Thông tin sản phẩm bắt buộc, và chọn luôn đường bay/biển vì mess được chuyển thành khách ngay khi lưu.
 */
export function MessFormDialog({
  draft,
  setDraft,
  title,
  submitLabel,
  formError,
  pending,
  onSave,
  onClose,
  marketOptions,
  goodsOptions,
  canConvert,
  lead = false,
  fieldErrors,
}: {
  draft: MessDraft | null;
  setDraft: Dispatch<SetStateAction<MessDraft | null>>;
  title: string;
  submitLabel: string;
  formError?: string;
  pending: boolean;
  onSave: () => void;
  onClose: () => void;
  marketOptions: ReadonlyArray<readonly [string, string]>;
  goodsOptions: string[];
  canConvert: boolean;
  lead?: boolean;
  /** Lỗi theo từng ô (id ô → thông báo), hiện đỏ ngay dưới ô. */
  fieldErrors?: Record<string, string>;
}) {
  const [orderDialog, setOrderDialog] = useState(false);
  const [demandChange, setDemandChange] = useState<MessDraft["demand"] | null>(null);
  const hasOrder = draft?.order != null && orderLineCount(draft.order) > 0;
  const update = (patch: Partial<MessDraft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

  return (
    <>
      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid max-h-[min(70vh,720px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {formError && <InlineAlert className="sm:col-span-2">{formError}</InlineAlert>}
              <Field label="Ngày" htmlFor="mess-date" error={fieldErrors?.["mess-date"]} required>
                <Input id="mess-date" type="date" value={draft.receivedOn} onChange={(event) => update({ receivedOn: event.target.value })} />
              </Field>
              <Field label="Tên khách" htmlFor="mess-name" error={fieldErrors?.["mess-name"]} required>
                <Input id="mess-name" value={draft.customerName} onChange={(event) => update({ customerName: event.target.value })} />
              </Field>
              <Field label="Thị trường" htmlFor="mess-market" error={fieldErrors?.["mess-market"]} hint="Chọn gợi ý hoặc gõ mới">
                <Input id="mess-market" list="mess-market-options" value={draft.market} placeholder="Ví dụ: Mỹ, Úc, Canada" onChange={(event) => update({ market: event.target.value })} />
                <datalist id="mess-market-options">
                  {marketOptions.map(([market]) => <option key={market} value={market} />)}
                </datalist>
              </Field>
              <Field label="Phân loại" htmlFor="mess-class" error={fieldErrors?.["mess-class"]}>
                <NativeSelect id="mess-class" value={draft.classification} onChange={(event) => update({ classification: event.target.value as MessDraft["classification"] })}>
                  <option value="">Chưa chọn</option>
                  {messageClassificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Đối tượng" htmlFor="mess-type" error={fieldErrors?.["mess-type"]} required={lead}>
                <NativeSelect id="mess-type" value={draft.customerType} onChange={(event) => update({ customerType: event.target.value as MessDraft["customerType"] })}>
                  <option value="">Chưa chọn</option>
                  {customerTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Nhu cầu" htmlFor="mess-demand" error={fieldErrors?.["mess-demand"]} required={lead} hint={lead ? "Tìm hàng = khách Sourcing, Vận chuyển = khách thuần Logistics" : undefined}>
                <NativeSelect
                  id="mess-demand"
                  value={draft.demand}
                  onChange={(event) => {
                    const next = event.target.value as MessDraft["demand"];
                    // Nháp thuộc về một loại khách (Sourcing hay thuần Logistics) nên đổi Nhu cầu phải làm lại.
                    if (draft.order && orderLineCount(draft.order) > 0 && next !== draft.demand) setDemandChange(next);
                    else update({ demand: next, shippingMode: "", logisticsClass: "" });
                  }}
                >
                  <option value="">Chưa chọn</option>
                  {demandOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              {lead && draft.demand === "SHIPPING" && (
                <>
                  <Field label="Phương thức vận chuyển" htmlFor="lead-mode" error={fieldErrors?.["lead-mode"]} required>
                    <NativeSelect id="lead-mode" value={draft.shippingMode} onChange={(event) => update({ shippingMode: event.target.value as MessDraft["shippingMode"], logisticsClass: "" })}>
                      <option value="">Chọn phương thức</option><option value="AIR">Đường bay</option><option value="SEA">Đường biển</option>
                    </NativeSelect>
                  </Field>
                  {draft.shippingMode === "SEA" && (
                    <Field label="Hình thức hàng biển" htmlFor="lead-class" error={fieldErrors?.["lead-class"]} required>
                      <NativeSelect id="lead-class" value={draft.logisticsClass} onChange={(event) => update({ logisticsClass: event.target.value as MessDraft["logisticsClass"] })}>
                        <option value="">Chọn LCL/FCL</option><option value="LCL">LCL</option><option value="FCL">FCL</option>
                      </NativeSelect>
                    </Field>
                  )}
                </>
              )}
              <Field label="Hàng hóa" htmlFor="mess-goods" error={fieldErrors?.["mess-goods"]} className="sm:col-span-2" required={lead} hint="Chọn gợi ý hoặc gõ mới">
                <Input id="mess-goods" list="mess-goods-options" value={draft.goods} onChange={(event) => update({ goods: event.target.value })} />
                <datalist id="mess-goods-options">
                  {goodsOptions.map((item) => <option key={item} value={item} />)}
                </datalist>
              </Field>
              <Field label="Ngành hàng" htmlFor="mess-industry" error={fieldErrors?.["mess-industry"]} className="sm:col-span-2">
                <NativeSelect id="mess-industry" value={draft.industry} onChange={(event) => update({ industry: event.target.value as MessDraft["industry"] })}>
                  <option value="">Chưa chọn</option>
                  {industryCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Sales - hot & warm" htmlFor="mess-sale" error={fieldErrors?.["mess-sale"]} className="sm:col-span-2" hint="Tự động theo tài khoản đăng nhập">
                <Input id="mess-sale" value={draft.saleName} readOnly />
              </Field>
              <Field label="Pain-Point của KH" htmlFor="mess-pain" error={fieldErrors?.["mess-pain"]} className="sm:col-span-2" required hint="Ghi chi tiết mô tả pain-point của khách">
                <Textarea id="mess-pain" rows={4} value={draft.painPoint} placeholder="Mô tả chi tiết vấn đề / nhu cầu của khách…" onChange={(event) => update({ painPoint: event.target.value })} />
              </Field>
              {!lead && (
                <Field label="Link mess" htmlFor="mess-link" error={fieldErrors?.["mess-link"]} className="sm:col-span-2">
                  <Input id="mess-link" value={draft.linkMess} placeholder="https://…" onChange={(event) => update({ linkMess: event.target.value })} />
                </Field>
              )}
              <Field label="Ghi chú Sale" htmlFor="mess-note" error={fieldErrors?.["mess-note"]} className="sm:col-span-2" required={lead}>
                <Textarea id="mess-note" value={draft.note} onChange={(event) => update({ note: event.target.value })} />
              </Field>
              {lead && <>
                <Field label="Nguồn" htmlFor="lead-brand" error={fieldErrors?.["lead-brand"]} required><NativeSelect id="lead-brand" value={draft.brand} onChange={(event) => update({ brand: event.target.value })}><option value="">Chưa chọn</option>{brandOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>
                <Field label="Kênh chăm sóc" htmlFor="lead-care" error={fieldErrors?.["lead-care"]} required><NativeSelect id="lead-care" value={draft.careChannel} onChange={(event) => update({ careChannel: event.target.value })}><option value="">Chưa chọn</option>{careChannelOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>
                <Field label="Số lượng" htmlFor="lead-quantity" error={fieldErrors?.["lead-quantity"]} required><Input id="lead-quantity" value={draft.quantityNote} onChange={(event) => update({ quantityNote: event.target.value })} /></Field>
                <Field label="Địa chỉ" htmlFor="lead-address" error={fieldErrors?.["lead-address"]} required><Input id="lead-address" value={draft.address} onChange={(event) => update({ address: event.target.value })} /></Field>
                {draft.demand === "SHIPPING" && <>
                  {draft.logisticsClass !== "FCL" && <Field label="Kích thước kiện hàng" htmlFor="lead-dimensions" error={fieldErrors?.["lead-dimensions"]} required><Input id="lead-dimensions" value={draft.packageDimensions} onChange={(event) => update({ packageDimensions: event.target.value })} /></Field>}
                  <Field label="Trọng lượng" htmlFor="lead-weight" error={fieldErrors?.["lead-weight"]} required><Input id="lead-weight" value={draft.weightKg} onChange={(event) => update({ weightKg: event.target.value })} /></Field>
                  <Field label="Địa chỉ nhận hàng" htmlFor="lead-ship-to" error={fieldErrors?.["lead-ship-to"]} required><Input id="lead-ship-to" value={draft.shipToAddress} onChange={(event) => update({ shipToAddress: event.target.value })} /></Field>
                  <Field label="Lý do chuyển" htmlFor="lead-reason" error={fieldErrors?.["lead-reason"]} required><Input id="lead-reason" value={draft.convertReason} onChange={(event) => update({ convertReason: event.target.value })} /></Field>
                </>}
              </>}
              {(canConvert || lead) && (
                <div className="grid gap-2 rounded-lg border p-3 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Thông tin sản phẩm{lead && <span className="text-destructive"> *</span>}</p>
                      <p className="text-sm text-muted-foreground">
                        {hasOrder
                          ? lead
                            ? `Đã nhập ${orderLineCount(draft.order)} dòng hàng. Bấm Tạo sẽ chuyển luôn sang báo giá.`
                            : `Đã nhập ${orderLineCount(draft.order)} dòng hàng. Bấm Chuyển sau khi lưu sẽ dùng luôn, không phải nhập lại.`
                          : lead
                            ? "Bắt buộc. Khách tiềm năng được tạo cùng thông tin đơn hàng này."
                            : "Không bắt buộc. Nhập trước để khi bấm Chuyển không phải nhập lại."}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {hasOrder && (
                        <Button type="button" variant="outline" size="sm" onClick={() => update({ order: null })}>Xóa</Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!draft.demand}
                        title={draft.demand ? undefined : "Chọn Nhu cầu trước"}
                        onClick={() => setOrderDialog(true)}
                      >
                        <Plus /> {hasOrder ? "Sửa thông tin sản phẩm" : "Thêm thông tin sản phẩm"}
                      </Button>
                    </div>
                  </div>
                  {!draft.demand && <p className="text-xs text-muted-foreground">Chọn Nhu cầu (Tìm hàng hoặc Vận chuyển) để nhập thông tin sản phẩm.</p>}
                  {draft.demand === "SHIPPING" && <p className="text-xs text-muted-foreground">Quy cách đóng gói có thể bổ sung ở bước báo giá. Hàng biển FCL nhập ở form cước riêng nên không dùng thông tin này.</p>}
                </div>
              )}
              <Field label="Số điện thoại" htmlFor="mess-phone" error={fieldErrors?.["mess-phone"]} required={lead} hint="Chỉ nhập số">
                <Input
                  id="mess-phone"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={draft.phone}
                  onChange={(event) => update({ phone: event.target.value.replace(/\D/g, "").slice(0, 30) })}
                />
              </Field>
              <Field label="Email" htmlFor="mess-email" error={fieldErrors?.["mess-email"]}>
                <Input id="mess-email" type="email" value={draft.email} onChange={(event) => update({ email: event.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Hủy</Button>
            <Button disabled={pending} onClick={onSave}>{pending ? "Đang lưu…" : submitLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={demandChange !== null}
        onOpenChange={(open) => { if (!open) setDemandChange(null); }}
        destructive
        title="Đổi Nhu cầu?"
        description="Thông tin sản phẩm đã nhập sẽ bị xóa, vì Tìm hàng (khách Sourcing) và Vận chuyển (khách thuần Logistics) đi theo hai bàn báo giá khác nhau."
        confirmLabel="Đổi và xóa"
        onConfirm={() => {
          const next = demandChange;
          setDemandChange(null);
          if (next !== null) update({ demand: next, order: null, shippingMode: "", logisticsClass: "" });
        }}
      />

      {orderDialog && draft?.demand && (
        <MessOrderDialog
          order={draft.order}
          onClose={() => setOrderDialog(false)}
          onSave={(order) => { const summary = orderSummary(order); update({ order, quantityNote: draft.quantityNote || summary.quantityNote, packageDimensions: draft.packageDimensions || summary.packageDimensions, weightKg: draft.weightKg || summary.weightKg }); }}
        />
      )}
    </>
  );
}
