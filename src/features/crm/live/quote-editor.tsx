"use client";

import { formatQuoteDay, isCombinedSourcing, isQuoteLang, quoteAttrKeyEn, quoteFileBase, quoteFreightTotal, quoteItemFeeLabel, quoteLangLabels, quoteLangs, quoteMoneyValue, quotePrintText, quoteSheetInputOf, quoteValidity, resolvedFreightCurrency, type QuoteLang } from "@speego/shared";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentProps, type ReactNode } from "react";
import { Download, Eye, ImagePlus, Pencil, Plus, Printer, RotateCcw, Send, Trash2 } from "lucide-react";
import {
  quoteCurrencies,
  quoteLineImages,
  quoteOrderSchema,
  updatePotentialSchema,
  updateQuoteSchema,
  type CrmLane,
  type QuoteBank,
  type QuoteCurrency,
  type QuoteLine,
  type QuoteNotes,
  type QuoteOrder,
  type UpdatePotentialInput,
  type UpdateQuoteInput,
} from "@speego/shared";
import { ContractCreateDialog } from "./contract-create-dialog";
import { QuotePaymentEditor } from "./quote-payment-editor";
import { emptyFclQuote, FclQuoteForm } from "./fcl-quote-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  brandOptions,
  careChannelOptions,
  classificationOptions,
  contractStatusOptions,
  customerKindOptions,
  customerTypeOptions,
  labelOf,
  potentialOptions,
  quoteStatusOptions,
  type QuoteRecord,
  type QuoteTemplateRecord,
} from "./types";
import { MoneyInput } from "@/components/shared/money-input";
import { formatMeasure, formatMeasureInput, formatMoneyGrouped, formatMoneyInput, parseMeasureInput } from "@/lib/format";
import { clipboardImage } from "@/lib/clipboard-image";
import { uploadDataImage, uploadImageFile, uploadImageFiles } from "@/lib/upload-image";
import { lineAmount, packageMetrics, packagesText, pricingBasisLabels, VOLUMETRIC_DIVISOR, type PricingBasis } from "@/services/crm/quote-lines";
import { downloadQuoteExcel } from "./quote-excel";
import { QuoteLanguageDialog, quoteOutputText, type QuoteOutputAction } from "./quote-language-dialog";
import { downloadQuotePdf, printQuoteSheet, quoteSheetHtml, quoteTotals } from "./quote-print";
import { buildQuoteSheet, orderForQuotePdf, quoteWithLogisticsCosts } from "./quote-sheet";
import { QuoteSheetPreview } from "./quote-sheet-preview";
import { RequirementImageSlider } from "./requirement-image-slider";
import { TableHScroll } from "./table-h-scroll";

function emptyLine(stt: string): QuoteLine {
  return { stt, productName: "", image: "", images: [], quantity: null, pricePerSet: null, lineTotal: null, lineTotalManual: false, weightKg: null, spec: "", note: "", specEn: "", noteEn: "", unit: "cái", basis: "unit", cbm: null, areaM2: null, packages: [], attrs: [], prices: [] };
}

const PRINT_LANG_KEY = "speego_quote_print_lang";
const ISSUED_DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });

/** Ngôn ngữ nhãn bản in/PDF/Excel, nhớ theo trình duyệt (không lưu DB). */
function readPrintLang(): QuoteLang {
  try {
    const stored = window.localStorage.getItem(PRINT_LANG_KEY);
    return isQuoteLang(stored) ? stored : "vi";
  } catch {
    return "vi";
  }}

function withImages(images: string[]): Pick<QuoteLine, "image" | "images"> {
  const next = images.filter(Boolean).slice(0, 8);
  return { images: next, image: next[0] ?? "" };
}

type SaleFact = [string, string, boolean?];

function WeightNoteField({
  id,
  notes,
  setNotes,
  lang,
  disabled,
  className,
}: {
  id: string;
  notes: QuoteNotes;
  setNotes: (notes: QuoteNotes) => void;
  /** Ngôn ngữ đang nhập: tiếng Anh sửa bản tiếng Anh và hiện bản tiếng Việt làm gợi ý. */
  lang: QuoteLang;
  disabled: boolean;
  className?: string;
}) {
  const english = lang === "en";
  const value = english ? notes.weightNoteEn : notes.weightNote;
  const placeholder = english ? notes.weightNote : undefined;
  return (
    <Field label="Ghi chú cân nặng / CBM" htmlFor={id} className={className}>
      <DraftText
        id={id}
        value={value}
        disabled={disabled}
        onValueChange={(next) => setNotes(english ? { ...notes, weightNoteEn: next } : { ...notes, weightNote: next })}
        placeholder={placeholder || "Dự kiến số KG/CBM, có thể thay đổi theo thực tế"}
      />
    </Field>
  );
}

type LogisticsFee = QuoteNotes["logisticsFees"][number];

function FeeCurrencySelect({ id, value, disabled, onChange }: { id: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const options = quoteCurrencies.includes(value as (typeof quoteCurrencies)[number]) ? [...quoteCurrencies] : [...quoteCurrencies, value];
  return (
    <NativeSelect id={id} className="h-11" aria-label="Loại tiền" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((code) => <option key={code} value={code}>{code}</option>)}
    </NativeSelect>
  );
}

function notesWithFreight(notes: QuoteNotes, orders: QuoteOrder[], shippingMode: "AIR" | "SEA" | null): QuoteNotes {
  const order = orders.find((item) => item.selected) ?? orders[0];
  const metrics = packageMetrics((order?.lines ?? []).flatMap((line) => line.packages), shippingMode);
  const freight = notes.freight ?? { rate: null, total: null, totalManual: false };
  if (freight.totalManual) return { ...notes, freight };
  const total = quoteFreightTotal(freight, metrics.count > 0 ? metrics.chargeableKg : null, metrics.count > 0 ? metrics.cbm : null) ?? freight.total;
  if (total === freight.total && notes.freight) return notes;
  return {
    ...notes,
    freight: { ...freight, total },
    shippingLabel: syncShippingLabel(notes.shippingLabel ?? "", total),
  };
}

function FreightCostEditor({
  notes,
  setNotes,
  order,
  shippingMode,
  canEdit,
  lang,
  fieldId,
}: {
  notes: QuoteNotes;
  setNotes: (notes: QuoteNotes) => void;
  order?: QuoteOrder;
  shippingMode: "AIR" | "SEA" | null;
  canEdit: boolean;
  lang: QuoteLang;
  fieldId: (name: string) => string;
}) {
  const metrics = packageMetrics((order?.lines ?? []).flatMap((line) => line.packages), shippingMode);
  const freight = notes.freight ?? { rate: null, total: null, totalManual: false };
  const chargeableKg = metrics.count > 0 ? metrics.chargeableKg : null;
  const chargeableCbm = metrics.count > 0 ? metrics.cbm : null;
  const autoTotal = quoteFreightTotal(freight, chargeableKg, chargeableCbm);
  const total = freight.totalManual ? freight.total : autoTotal ?? freight.total;
  const note = (lang === "en" ? quotePrintText.en : quotePrintText.vi).freightNote;
  const write = (next: QuoteNotes["freight"]) => {
    const shown = next.totalManual ? next.total : quoteFreightTotal(next, chargeableKg, chargeableCbm) ?? next.total;
    setNotes({
      ...notes,
      freight: { ...next, total: shown },
      shippingLabel: syncShippingLabel(notes.shippingLabel ?? "", shown),
    });
  };
  return (
    <div className="grid gap-2">
      <div>
        <h4 className="text-sm font-semibold">Chi phí vận chuyển</h4>
        <p className="text-sm text-muted-foreground">Chọn tính theo kg, CBM hoặc cộng cả hai. Có thể ghi đè tiền cước.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Đơn vị tính cước" htmlFor={fieldId("freight-basis")}>
          <NativeSelect id={fieldId("freight-basis")} value={freight.basis} disabled={!canEdit} onChange={(event) => write({ ...freight, basis: event.target.value as QuoteNotes["freight"]["basis"] })}>
            <option value="kg">Theo kg</option><option value="cbm">Theo CBM</option><option value="both">Cả kg và CBM</option>
          </NativeSelect>
        </Field>
        <Field label="Loại tiền cước" htmlFor={fieldId("freight-currency")}>
          <FeeCurrencySelect id={fieldId("freight-currency")} value={freight.currency || resolvedFreightCurrency(notes, order?.currency || "VND")} disabled={!canEdit} onChange={(currency) => write({ ...freight, currency })} />
        </Field>
        {freight.basis !== "cbm" && <Field label="Giá cước / kg" htmlFor={fieldId("freight-rate")}>
          <MoneyInput id={fieldId("freight-rate")} fractionDigits={3} value={freight.rate} disabled={!canEdit} onValueChange={(rate) => write({ ...freight, rate })} aria-label="Giá cước / kg" />
        </Field>}
        {freight.basis !== "kg" && <Field label="Giá cước / CBM" htmlFor={fieldId("freight-cbm-rate")}>
          <MoneyInput id={fieldId("freight-cbm-rate")} fractionDigits={3} value={freight.cbmRate} disabled={!canEdit} onValueChange={(cbmRate) => write({ ...freight, cbmRate })} aria-label="Giá cước / CBM" />
        </Field>}
        <Field label="Cân nặng tính phí (kg)" htmlFor={fieldId("freight-kg")}>
          <Input id={fieldId("freight-kg")} readOnly value={chargeableKg == null ? "" : formatMeasure(chargeableKg)} aria-label="Cân nặng tính phí" />
        </Field>
        <Field label="Thể tích tính phí (CBM)" htmlFor={fieldId("freight-cbm")}>
          <Input id={fieldId("freight-cbm")} readOnly value={chargeableCbm == null ? "" : formatMeasure(chargeableCbm)} aria-label="Thể tích tính phí" />
        </Field>
        <Field label="Tiền cước" htmlFor={fieldId("freight-total")}>
          <MoneyInput id={fieldId("freight-total")} fractionDigits={3} value={total} disabled={!canEdit} aria-label="Tiền cước vận chuyển" onValueChange={(value) => write({ ...freight, total: value, totalManual: value !== autoTotal })} />
          {freight.totalManual && canEdit && (
            <button type="button" className="text-left text-[11px] text-primary underline" onClick={() => write({ ...freight, total: autoTotal, totalManual: false })}>Tính lại</button>
          )}
        </Field>
      </div>
      <p className="text-sm italic text-muted-foreground">{note}</p>
    </div>
  );
}

function LogisticsFeesEditor({
  children,
  notes,
  setNotes,
  canEdit,
  canEditOrderNotes = false,
  pending,
  fieldId,
  order,
  shippingMode,
  lang = "vi",
}: {
  children?: ReactNode;
  notes: QuoteNotes;
  setNotes: (notes: QuoteNotes) => void;
  canEdit: boolean;
  canEditOrderNotes?: boolean;
  pending: boolean;
  fieldId: (name: string) => string;
  /** Đơn đang báo giá: mỗi mặt hàng của đơn có một dòng chi phí riêng. */
  order?: QuoteOrder;
  shippingMode: "AIR" | "SEA" | null;
  /** Ngôn ngữ nội dung đang sửa. Tiếng Anh chỉ sửa chữ, thêm/xóa dòng làm ở tiếng Việt. */
  lang?: QuoteLang;
}) {
  const fees = notes.logisticsFees ?? [];
  const currency = order?.currency || "VND";
  const freightCurrency = resolvedFreightCurrency(notes, currency);
  const items = (order?.lines ?? []).map((line, index) => ({ stt: line.stt.trim() || String(index + 1), line }));
  const itemKeys = new Set(items.map((item) => item.stt));
  /** Phí chung, gồm cả phí của mặt hàng đã bị xóa để không mất dữ liệu. */
  const generalFees = fees.map((fee, index) => ({ fee, index })).filter(({ fee }) => !fee.itemStt || !itemKeys.has(fee.itemStt));
  const metrics = packageMetrics((order?.lines ?? []).flatMap((line) => line.packages), shippingMode);
  const freight = notes.freight;
  const freightTotal = freight.totalManual ? freight.total : quoteFreightTotal(freight, metrics.count ? metrics.chargeableKg : null, metrics.count ? metrics.cbm : null) ?? freight.total;
  const totals = new Map<string, number>();
  for (const fee of fees) {
    const value = quoteMoneyValue(fee.value);
    if (value == null) continue;
    const code = fee.currency || currency;
    totals.set(code, Math.round(((totals.get(code) ?? 0) + value) * 1000) / 1000);
  }
  if (freightTotal != null) {
    const code = freight.currency?.trim() || freightCurrency;
    totals.set(code, Math.round(((totals.get(code) ?? 0) + freightTotal) * 1000) / 1000);
  }
  const emptyFee = (patch: Partial<LogisticsFee>): LogisticsFee => ({ label: "", labelEn: "", value: "", currency: "", itemStt: "", ...patch });

  const patchFee = (index: number, patch: Partial<LogisticsFee>) => {
    setNotes({ ...notes, logisticsFees: fees.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) });
  };
  const patchItemFee = (stt: string, line: QuoteLine, patch: Partial<LogisticsFee>) => {
    const index = fees.findIndex((fee) => fee.itemStt === stt);
    if (index >= 0) {
      patchFee(index, patch);
      return;
    }
    if (fees.length >= 30) return;
    setNotes({ ...notes, logisticsFees: [...fees, emptyFee({ label: quoteItemFeeLabel("vi", stt, line.spec), itemStt: stt, ...patch })] });
  };
  const addFee = () => {
    if (fees.length >= 30) return;
    setNotes({ ...notes, logisticsFees: [...fees, emptyFee({})] });
  };

  return (
    <div className="grid gap-3 rounded-xl border p-4 text-base">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Chi phí logistics</h3>
          <p className="text-sm text-muted-foreground">Mỗi mặt hàng của đơn có một dòng chi phí, chọn loại tiền cho từng dòng. Có thể thêm phí chung.</p>
        </div>
        {canEdit && lang === "vi" ? (
          <Button type="button" variant="outline" size="sm" disabled={pending || fees.length >= 30} onClick={() => addFee()}>
            <Plus />Thêm phí chung
          </Button>
        ) : null}
      </div>

      {children}
      <FreightCostEditor notes={notes} setNotes={setNotes} order={order} shippingMode={shippingMode} canEdit={canEdit} lang={lang} fieldId={fieldId} />

      <div className="grid gap-3 [&_label]:text-base [&_input]:h-11 [&_input]:text-base">
        <WeightNoteField id={fieldId("note-weight")} notes={notes} setNotes={setNotes} lang={lang} disabled={!canEditOrderNotes} />
      </div>

      {items.length > 0 && (
        <div className="grid gap-3">
          <h4 className="text-sm font-semibold">Chi phí theo từng mặt hàng</h4>
          {items.map(({ stt, line }) => {
            const fee = fees.find((item) => item.itemStt === stt);
            const label = fee?.label || quoteItemFeeLabel("vi", stt, line.spec);
            return (
              <div key={stt} className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_8rem] sm:items-end">
                <p className="text-sm font-medium" title={label}>{label}</p>
                <Field label="Số tiền / ghi chú" htmlFor={fieldId(`item-fee-value-${stt}`)}>
                  <Input
                    id={fieldId(`item-fee-value-${stt}`)}
                    value={moneyText(fee?.value ?? "")}
                    disabled={!canEdit}
                    onChange={(event) => patchItemFee(stt, line, { value: formatMoneyInput(event.target.value) })}
                    placeholder="Số tiền hoặc mô tả"
                  />
                </Field>
                <Field label="Loại tiền" htmlFor={fieldId(`item-fee-currency-${stt}`)}>
                  <FeeCurrencySelect
                    id={fieldId(`item-fee-currency-${stt}`)}
                    value={fee?.currency || currency}
                    disabled={!canEdit}
                    onChange={(code) => patchItemFee(stt, line, { currency: code })}
                  />
                </Field>
              </div>
            );
          })}
        </div>
      )}

      {generalFees.length === 0 && items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Chưa có dòng chi phí chi tiết. Bấm Thêm phí chung để nhập.
        </p>
      ) : generalFees.length > 0 ? (
        <div className="grid gap-3">
          <h4 className="text-sm font-semibold">Phí chung</h4>
          {generalFees.map(({ fee, index }) => (
            <div key={index} className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_8rem_auto] sm:items-end">
              <Field label="Tên chi phí" htmlFor={fieldId(`fee-label-${index}`)}>
                <Input
                  id={fieldId(`fee-label-${index}`)}
                  value={lang === "en" ? fee.labelEn : fee.label}
                  disabled={!canEdit}
                  onChange={(event) => patchFee(index, lang === "en" ? { labelEn: event.target.value } : { label: event.target.value })}
                  placeholder={lang === "en" ? fee.label : "Ví dụ: Chi phí cảng biển"}
                />
              </Field>
              <Field label="Số tiền / ghi chú" htmlFor={fieldId(`fee-value-${index}`)}>
                <Input
                  id={fieldId(`fee-value-${index}`)}
                  value={moneyText(fee.value)}
                  disabled={!canEdit}
                  onChange={(event) => patchFee(index, { value: formatMoneyInput(event.target.value) })}
                  placeholder="Số tiền hoặc mô tả"
                />
              </Field>
              <Field label="Loại tiền" htmlFor={fieldId(`fee-currency-${index}`)}>
                <FeeCurrencySelect
                  id={fieldId(`fee-currency-${index}`)}
                  value={fee.currency || currency}
                  disabled={!canEdit}
                  onChange={(code) => patchFee(index, { currency: code })}
                />
              </Field>
              {canEdit && lang === "vi" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="justify-self-end"
                  aria-label={`Xóa chi phí ${index + 1}`}
                  disabled={pending}
                  onClick={() => setNotes({ ...notes, logisticsFees: fees.filter((_, itemIndex) => itemIndex !== index) })}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="border-t pt-3">
        <h4 className="font-semibold">Tổng chi phí logistics</h4>
        <p className="text-sm text-muted-foreground">Tiền cước + phụ phí, cộng riêng theo từng loại tiền.</p>
        {totals.size ? [...totals].map(([code, amount]) => <p key={code} className="text-right font-semibold tabular-nums">{formatMoneyGrouped(amount)} {code}</p>) : <p className="text-sm text-muted-foreground">Chưa có số tiền.</p>}
      </div>
    </div>
  );
}

function OrderPackagesBlock({
  orders,
  shippingMode,
  canEdit,
  onChange,
  emptyHint,
}: {
  orders: QuoteOrder[];
  shippingMode: "AIR" | "SEA" | null;
  canEdit: boolean;
  onChange: (orderId: string, lineIndex: number, packages: QuoteLine["packages"]) => void;
  emptyHint?: string;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <h3 className="text-base font-medium">Quy cách đóng gói theo dòng hàng</h3>
        <p className="text-sm text-muted-foreground">Điền số kiện · D × R × C · kg/kiện cho từng dòng để tính cước và báo giá vận chuyển.</p>
      </div>
      {orders.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{emptyHint ?? "Chưa có thông tin đơn hàng — tạo ở tab Sourcing trước."}</p>
      )}
      {orders.map((order) => (
        <div key={order.id} className="grid gap-3 rounded-xl border p-3">
          <p className="font-medium">{order.name || "Không tên"} · {order.currency}</p>
          {order.lines.length === 0 && <p className="text-sm text-muted-foreground">Chưa có dòng hàng.</p>}
          {order.lines.map((line, lineIndex) => (
            <LinePackagesEditor
              key={`${order.id}-${lineIndex}`}
              line={line}
              shippingMode={shippingMode}
              lineLabel={`STT ${line.stt || lineIndex + 1}`}
              canEdit={canEdit}
              onChange={(packages) => onChange(order.id, lineIndex, packages)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

type SaleLeadDraft = {
  fullName: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  productInterest: string;
  quantityNote: string;
  saleNote: string;
  potential: UpdatePotentialInput["potential"];
  customerKind: "" | NonNullable<UpdatePotentialInput["customerKind"]>;
  customerType: "" | NonNullable<UpdatePotentialInput["customerType"]>;
  brand: "" | NonNullable<UpdatePotentialInput["brand"]>;
  careChannel: "" | NonNullable<UpdatePotentialInput["careChannel"]>;
  classification: "" | NonNullable<UpdatePotentialInput["classification"]>;
  packSpec: string;
  packageDimensions: string;
  weightKg: string;
  logisticsClass: "" | NonNullable<UpdatePotentialInput["logisticsClass"]>;
  shippingMode: "" | NonNullable<UpdatePotentialInput["shippingMode"]>;
  shipFromAddress: string;
  shipToAddress: string;
  requirements: string;
  requirementImages: string[];
};

function saleDraftFromQuote(row: QuoteRecord): SaleLeadDraft {
  return {
    fullName: row.customerName ?? "",
    companyName: row.companyName ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    productInterest: row.goods ?? "",
    quantityNote: row.quantityNote ?? "",
    saleNote: row.saleNote ?? "",
    potential: potentialOptions.some((item) => item[0] === row.potential) ? row.potential as SaleLeadDraft["potential"] : "POTENTIAL",
    customerKind: row.customerKind === "SOURCING" || row.customerKind === "LOGISTICS" ? row.customerKind : "",
    customerType: row.customerType === "INDIVIDUAL" || row.customerType === "PRINCIPAL" || row.customerType === "ENTERPRISE" ? row.customerType : "",
    brand: brandOptions.some((item) => item[0] === row.brand) ? row.brand as SaleLeadDraft["brand"] : "",
    careChannel: careChannelOptions.some((item) => item[0] === row.careChannel) ? row.careChannel as SaleLeadDraft["careChannel"] : "",
    classification: row.classification === "LCL" || row.classification === "FCL" ? row.classification : "",
    packSpec: row.packSpec ?? "",
    packageDimensions: row.packageDimensions ?? "",
    weightKg: row.weightKg == null ? "" : String(row.weightKg),
    logisticsClass: row.logisticsClass === "LCL" || row.logisticsClass === "FCL" ? row.logisticsClass : "",
    shippingMode: row.shippingMode ?? "",
    shipFromAddress: row.shipFromAddress ?? "",
    shipToAddress: row.shipToAddress ?? "",
    requirements: row.requirements ?? "",
    requirementImages: row.requirementImages ?? [],
  };
}

export function quoteFieldsFromPotential(input: UpdatePotentialInput, images: string[]): Partial<QuoteRecord> {
  return {
    customerName: input.fullName,
    companyName: input.companyName || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    customerKind: input.customerKind ?? null,
    customerType: input.customerType ?? null,
    brand: input.brand ?? null,
    potential: input.potential,
    careChannel: input.careChannel ?? null,
    classification: input.classification ?? null,
    goods: input.productInterest || null,
    quantityNote: input.quantityNote || null,
    saleNote: input.saleNote || null,
    packSpec: input.packSpec ?? null,
    packageDimensions: input.packageDimensions ?? null,
    weightKg: input.weightKg ?? null,
    logisticsClass: input.logisticsClass ?? null,
    shippingMode: input.shippingMode ?? null,
    shipFromAddress: input.shipFromAddress ?? null,
    shipToAddress: input.shipToAddress ?? null,
    requirements: input.requirements ?? null,
    requirementImages: input.requirementImages ?? images,
  };
}

function SaleFactsTable({ groups, bare = false }: { groups: { title: string; rows: SaleFact[] }[]; bare?: boolean }) {
  const cellValue = (value: string) => {
    const empty = !value || value === "—";
    return (
      <td className={`px-4 py-3 text-base break-words whitespace-pre-wrap ${empty ? "text-muted-foreground/70" : "font-medium"}`}>
        {value}
      </td>
    );
  };

  return (
    <div className={bare ? "overflow-x-auto" : "overflow-x-auto rounded-lg border"}>
      <table className="w-full text-base">
        <tbody>
          {groups.map((group) => {
            const pairs: SaleFact[][] = [];
            for (let i = 0; i < group.rows.length; ) {
              const [label, value, wide] = group.rows[i]!;
              if (wide) {
                pairs.push([[label, value, true]]);
                i += 1;
                continue;
              }
              const next = group.rows[i + 1];
              if (next && !next[2]) {
                pairs.push([[label, value], next]);
                i += 2;
              } else {
                pairs.push([[label, value]]);
                i += 1;
              }
            }
            return (
              <Fragment key={group.title || group.rows[0]?.[0] || "group"}>
                {group.title ? (
                  <tr className="border-b bg-muted/50">
                    <th colSpan={4} className="px-4 py-3 text-left text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.title}
                    </th>
                  </tr>
                ) : null}
                {pairs.map((pair, index) => {
                  if (pair.length === 1 && pair[0]![2]) {
                    const [label, value] = pair[0]!;
                    const empty = !value || value === "—";
                    return (
                      <tr key={`${group.title}-${label}-${index}`} className="border-b last:border-0">
                        <th className="w-[11rem] whitespace-nowrap bg-muted/20 px-4 py-3 text-left text-base font-medium text-muted-foreground align-top">{label}</th>
                        <td colSpan={3} className={`px-4 py-3 text-base break-words whitespace-pre-wrap ${empty ? "text-muted-foreground/70" : "font-medium"}`}>{value}</td>
                      </tr>
                    );
                  }
                  const left = pair[0]!;
                  const right = pair[1];
                  return (
                    <tr key={`${group.title}-${left[0]}-${index}`} className="border-b last:border-0">
                      <th className="w-[11rem] whitespace-nowrap bg-muted/20 px-4 py-3 text-left text-base font-medium text-muted-foreground align-top">{left[0]}</th>
                      {cellValue(left[1])}
                      {right ? (
                        <>
                          <th className="w-[11rem] whitespace-nowrap bg-muted/20 px-4 py-3 text-left text-base font-medium text-muted-foreground align-top">{right[0]}</th>
                          {cellValue(right[1])}
                        </>
                      ) : (
                        <td colSpan={2} />
                      )}
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function amountValue(value: string): number | null {
  const trimmed = value.trim().replaceAll(",", "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyText(raw: string): string {
  const amount = quoteMoneyValue(raw);
  return amount == null ? raw : formatMoneyGrouped(amount);
}

function amountText(value: number | null): string {
  return value == null ? "" : String(value);
}

function filledLine(line: QuoteLine): boolean {
  return Boolean(line.stt || line.productName || quoteLineImages(line).length > 0 || line.quantity != null || line.pricePerSet != null || line.lineTotal != null || line.weightKg != null || line.spec || line.note || line.packages.length > 0);
}

function packagesSummary(packages: QuoteLine["packages"], shippingMode: "AIR" | "SEA" | null): string {
  const m = packageMetrics(packages, shippingMode);
  return `${m.count} kiện · ${m.cbm} cbm · tính cước ${m.chargeableKg} kg`;
}

const factoryAttrKeys = ["Chất liệu", "MOQ", "Lead time", "Bảo hành"] as const;
const logisticsAttrKeys = factoryAttrKeys.filter((key) => key !== "MOQ" && key !== "Bảo hành");

function attrValue(attrs: QuoteLine["attrs"], key: string, lang: QuoteLang = "vi"): string {
  const item = attrs.find((attr) => attr.key === key);
  return (lang === "en" ? item?.valueEn : item?.value) ?? "";
}

function withAttr(attrs: QuoteLine["attrs"], key: string, value: string, lang: QuoteLang = "vi"): QuoteLine["attrs"] {
  const known = new Set<string>(factoryAttrKeys);
  const extras = attrs.filter((item) => !known.has(item.key) && (item.key.trim() || item.value.trim() || item.keyEn.trim() || item.valueEn.trim()));
  const next = factoryAttrKeys
    .map((itemKey) => {
      const current = attrs.find((item) => item.key === itemKey);
      const item = { key: itemKey, value: current?.value ?? "", keyEn: current?.keyEn ?? "", valueEn: current?.valueEn ?? "" };
      if (itemKey === key) {
        if (lang === "en") item.valueEn = value;
        else item.value = value;
      }
      return item.value.trim() || item.valueEn.trim() ? { ...item, value: item.value.trim(), valueEn: item.valueEn.trim() } : null;
    })
    .filter((item) => item != null);
  return [...next, ...extras];
}

function MeasureInput({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => (value ? formatMeasure(value) : ""));
  useEffect(() => {
    if (!focused) setText(value ? formatMeasure(value) : "");
  }, [value, focused]);
  return (
    <Input
      {...props}
      inputMode="decimal"
      value={focused ? text : value ? formatMeasure(value) : ""}
      onFocus={(event) => {
        setFocused(true);
        setText(value ? formatMeasure(value) : "");
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        const next = text.trim() ? parseMeasureInput(text) ?? 0 : 0;
        onValueChange(next);
        setText(next ? formatMeasure(next) : "");
        props.onBlur?.(event);
      }}
      onChange={(event) => {
        const next = formatMeasureInput(event.target.value);
        setText(next);
        onValueChange(next.trim() ? parseMeasureInput(next) ?? 0 : 0);
      }}
    />
  );
}

function LinePackagesEditor({
  line,
  shippingMode,
  lineLabel,
  canEdit,
  error,
  fieldError,
  onChange,
}: {
  line: QuoteLine;
  shippingMode: "AIR" | "SEA" | null;
  lineLabel: string;
  canEdit: boolean;
  error?: string;
  fieldError?: (packageIndex: number, key: string) => string | undefined;
  onChange: (packages: QuoteLine["packages"]) => void;
}) {
  return (
    <div
      aria-invalid={error ? true : undefined}
      className={`grid gap-2 rounded-md border-2 p-3 ${
        error
          ? "border-danger bg-red-50"
          : line.packages.length === 0
            ? "border-amber-600 bg-amber-50"
            : "border-amber-500/50 bg-amber-50/60"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-amber-950">
          Quy cách đóng gói <span className="text-amber-700" aria-hidden>*</span>
          {lineLabel ? <span className="font-medium text-amber-900/80"> · {lineLabel}</span> : null}
        </p>
        {line.packages.length === 0 ? (
          <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Bắt buộc — đừng bỏ sót
          </span>
        ) : (
          <span className="text-xs text-amber-900">{packagesSummary(line.packages, shippingMode)}</span>
        )}
      </div>
      <p className="text-[11px] text-amber-900/80">Số kiện · D × R × C (cm, nhập được 35,8) · kg/kiện. Cân thể tích = D × R × C / {VOLUMETRIC_DIVISOR[shippingMode ?? "SEA"]}; mỗi kiện lấy số lớn hơn giữa cân thực và cân thể tích, rồi cộng lại.</p>
      {line.packages.map((pkg, pi) => (
        <div key={pi} className="grid gap-1">
          <div className="flex flex-wrap items-center gap-1">
            {(["count", "lengthCm", "widthCm", "heightCm", "actualKg"] as const).map((key) => {
              const message = fieldError?.(pi, key);
              const shared = {
                className: "h-8 w-[4.5rem] border-amber-700/30 bg-white",
                placeholder: { count: "Số kiện", lengthCm: "D cm", widthCm: "R cm", heightCm: "C cm", actualKg: "kg/kiện" }[key],
                "aria-label": `Kiện ${pi + 1} ${lineLabel}: ${key}`,
                "aria-invalid": message ? true : undefined,
                disabled: !canEdit,
              } as const;
              if (key === "count") {
                return (
                  <Input
                    key={key}
                    {...shared}
                    inputMode="numeric"
                    value={pkg.count ? String(pkg.count) : ""}
                    onChange={(event) => {
                      const parsed = Number(event.target.value.replace(/[^\d]/g, ""));
                      onChange(line.packages.map((x, xi) => (xi === pi ? { ...x, count: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 } : x)));
                    }}
                  />
                );
              }
              return (
                <MeasureInput
                  key={key}
                  {...shared}
                  value={pkg[key]}
                  onValueChange={(next) => onChange(line.packages.map((x, xi) => (xi === pi ? { ...x, [key]: next } : x)))}
                />
              );
            })}
            {canEdit && (
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Xóa kiện ${pi + 1}`} onClick={() => onChange(line.packages.filter((_, xi) => xi !== pi))}>
                <Trash2 />
              </Button>
            )}
          </div>
          <InputError message={["count", "lengthCm", "widthCm", "heightCm", "actualKg"].map((key) => fieldError?.(pi, key)).find(Boolean)} />
        </div>
      ))}
      <InputError message={error} />
      {canEdit && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit border-amber-700/40 bg-white"
          onClick={() => onChange([...line.packages, { count: 1, lengthCm: 0, widthCm: 0, heightCm: 0, actualKg: 0 }])}
        >
          <Plus />Thêm kiện
        </Button>
      )}
    </div>
  );
}

function money(value: number): string {
  return formatMoneyGrouped(value, 3);
}

function syncShippingLabel(current: string, total: number | null): string {
  const numeric = !current.trim() || quoteMoneyValue(current) != null;
  if (!numeric) return current;
  return total == null ? "" : formatMoneyGrouped(total, 3);
}

/** Tổng số lượng gom theo đơn vị tính, vd "120 set, 30 kg". */
function orderQuantityText(lines: QuoteLine[]): string {
  const byUnit = new Map<string, number>();
  for (const line of lines) {
    if (line.quantity == null) continue;
    const unit = line.unit?.trim() || "cái";
    byUnit.set(unit, (byUnit.get(unit) ?? 0) + line.quantity);
  }
  return [...byUnit].map(([unit, total]) => `${money(total)} ${unit}`).join(", ");
}

/** Mô tả ngắn của mẫu: quy cách / thuộc tính dòng đầu có dữ liệu. */
function orderSpecText(lines: QuoteLine[]): string {
  for (const line of lines) {
    const spec = line.spec.trim();
    if (spec) return spec;
    const attrs = line.attrs.filter((attr) => attr.value.trim()).map((attr) => `${attr.key}: ${attr.value}`).join(" · ");
    if (attrs) return attrs;
  }
  return "";
}

function orderNoteText(lines: QuoteLine[]): string {
  return lines.map((line) => line.note.trim()).filter(Boolean).join("\n");
}

type PriceColumn = { currency: string };

/** Ô nhập số nhân của cách tính giá theo kg, m2 hoặc CBM: trường dữ liệu và nhãn. */
const basisMetric = {
  kg: { field: "weightKg", label: "kg", aria: "Kg mỗi đơn vị" },
  m2: { field: "areaM2", label: "m2", aria: "m2 mỗi đơn vị" },
  cbm: { field: "cbm", label: "CBM", aria: "CBM mỗi đơn vị" },
} as const;

function BasisMetricInput({ line, index, disabled, className, onChange }: {
  line: QuoteLine;
  index: number;
  disabled: boolean;
  className?: string;
  onChange: (patch: Partial<QuoteLine>) => void;
}) {
  const metric = basisMetric[line.basis as keyof typeof basisMetric];
  if (!metric) return null;
  return (
    <Input
      className={className}
      inputMode="decimal"
      aria-label={`${metric.aria} dòng ${index + 1}`}
      value={amountText(line[metric.field])}
      disabled={disabled}
      placeholder={`${metric.label} / ${line.unit?.trim() || "cái"}`}
      onChange={(event) => onChange({ [metric.field]: amountValue(event.target.value) })}
    />
  );
}

function priceUnit(line: Pick<QuoteLine, "basis" | "unit">): string {
  return line.basis === "kg" ? "kg" : line.basis === "m2" ? "m2" : line.basis === "cbm" ? "CBM" : line.basis === "lump" ? "trọn gói" : line.unit?.trim() || "cái";
}

/** Cột giá của một đơn: loại tiền chính, rồi các cột đã thêm. VND đứng trước. */
function columnsFor(order: QuoteOrder): PriceColumn[] {
  const extras = (order.priceColumns ?? []).filter((column) => column.currency !== order.currency);
  const cols: PriceColumn[] = [{ currency: order.currency || "VND" }, ...extras];
  const seen = new Set<string>();
  const unique = cols.filter((column) => {
    if (seen.has(column.currency)) return false;
    seen.add(column.currency);
    return true;
  });
  return [...unique.filter((column) => column.currency === "VND"), ...unique.filter((column) => column.currency !== "VND")];
}

function listPriceColumns(orders: QuoteOrder[]): PriceColumn[] {
  const list: PriceColumn[] = [];
  for (const order of orders) {
    for (const column of columnsFor(order)) {
      if (!list.some((item) => item.currency === column.currency)) list.push(column);
    }
  }
  if (list.length === 0) list.push({ currency: "VND" });
  return [...list.filter((column) => column.currency === "VND"), ...list.filter((column) => column.currency !== "VND")];
}

function lineCurrencyPrice(line: QuoteLine, orderCurrency: string, currency: string): { price: number | null; total: number | null; totalManual: boolean } {
  if (currency === orderCurrency) return { price: line.pricePerSet, total: line.lineTotal, totalManual: line.lineTotalManual === true };
  const found = (line.prices ?? []).find((item) => item.currency === currency);
  return { price: found?.pricePerSet ?? null, total: found?.lineTotal ?? null, totalManual: found?.lineTotalManual === true };
}

function columnAmounts(order: QuoteOrder, currency: string): { texts: string[]; total: number | null } {
  const rows = order.lines.map((line) => ({ line, ...lineCurrencyPrice(line, order.currency, currency) }));
  const texts = rows
    .filter((row) => row.price != null)
    .map((row) => `${money(row.price!)} ${currency}/${priceUnit(row.line)}`);
  const priced = rows.some((row) => row.total != null);
  return { texts, total: priced ? rows.reduce((sum, row) => sum + (row.total ?? 0), 0) : null };
}

/** Tính lại thành tiền (đơn giá chính và các loại tiền thêm) theo cách tính giá và số nhân của dòng. */
function recalcLine(line: QuoteLine): QuoteLine {
  const base = { basis: line.basis, quantity: line.quantity, weightKg: line.weightKg, cbm: line.cbm, areaM2: line.areaM2 };
  const total = lineAmount({ ...base, price: line.pricePerSet });
  return {
    ...line,
    lineTotal: line.lineTotalManual ? line.lineTotal : total != null ? total : line.lineTotal,
    prices: (line.prices ?? []).map((item) => {
      if (item.lineTotalManual) return item;
      const alt = lineAmount({ ...base, price: item.pricePerSet });
      return alt == null ? item : { ...item, lineTotal: alt };
    }),
  };
}

function withCurrencyPrice(line: QuoteLine, orderCurrency: string, currency: string, pricePerSet: number | null): QuoteLine {
  const total = lineAmount({ basis: line.basis, quantity: line.quantity, price: pricePerSet, weightKg: line.weightKg, cbm: line.cbm, areaM2: line.areaM2 });
  if (currency === orderCurrency) return line.lineTotalManual ? { ...line, pricePerSet } : { ...line, pricePerSet, lineTotal: total };
  const existing = (line.prices ?? []).find((item) => item.currency === currency);
  const keep = existing?.lineTotalManual === true;
  const prices = [...(line.prices ?? []).filter((item) => item.currency !== currency), { currency, pricePerSet, lineTotal: keep ? existing?.lineTotal ?? total : total, lineTotalManual: keep }];
  return { ...line, prices };
}

type OrderIssue = { path: PropertyKey[]; message: string };

function pathIndex(value: PropertyKey | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

/** Đường dẫn Zod của đơn hàng thành khóa ô trên form. */
function orderFieldKey(order: QuoteOrder, path: PropertyKey[]): string | null {
  const [head, second, third, fourth, fifth] = path;
  const lineIndex = pathIndex(second);
  if (head === "name") return "name";
  if (head === "lines" && lineIndex == null) return "lines";
  if (head === "rate") return `rate.${order.currency}`;
  if (head === "priceColumns") {
    const columnIndex = pathIndex(second);
    const column = columnIndex == null ? undefined : order.priceColumns?.[columnIndex];
    if (third === "rate" && column) return `rate.${column.currency}`;
    return null;
  }
  if (head !== "lines" || lineIndex == null) return null;
  const line = order.lines[lineIndex];
  if (third == null) return `line.${lineIndex}`;
  if (third === "quantity") return `line.${lineIndex}.quantity`;
  if (third === "unit") return `line.${lineIndex}.unit`;
  if (third === "spec") return `line.${lineIndex}.spec`;
  if (third === "note") return `line.${lineIndex}.note`;
  if (third === "stt") return `line.${lineIndex}.stt`;
  if (third === "weightKg") return `line.${lineIndex}.weight`;
  if (third === "cbm") return `line.${lineIndex}.cbm`;
  if (third === "image" || third === "images") return `line.${lineIndex}.images`;
  if (third === "pricePerSet") return `line.${lineIndex}.price.${order.currency}`;
  if (third === "lineTotal") return `line.${lineIndex}.total.${order.currency}`;
  if (third === "packages" && fourth == null) return `line.${lineIndex}.packages`;
  if (third === "packages") {
    const packageIndex = pathIndex(fourth);
    if (packageIndex == null || typeof fifth !== "string") return `line.${lineIndex}.packages`;
    return `line.${lineIndex}.package.${packageIndex}.${fifth}`;
  }
  if (third === "prices") {
    const priceIndex = pathIndex(fourth);
    const currency = priceIndex == null ? undefined : line?.prices?.[priceIndex]?.currency;
    if (!currency) return null;
    const field = fifth === "lineTotal" ? "total" : "price";
    return `line.${lineIndex}.${field}.${currency}`;
  }
  return null;
}

function orderIssueFields(order: QuoteOrder, issues: OrderIssue[]): { fields: Record<string, string>; rest: string[] } {
  const fields: Record<string, string> = {};
  const rest: string[] = [];
  for (const issue of issues) {
    const key = orderFieldKey(order, issue.path);
    if (!key) {
      if (!rest.includes(issue.message)) rest.push(issue.message);
      continue;
    }
    if (!fields[key]) fields[key] = issue.message;
  }
  return { fields, rest };
}

function withoutOrderFields(current: Record<string, string>, prefixes: string[]): Record<string, string> {
  const next = { ...current };
  let changed = false;
  for (const key of Object.keys(next)) {
    if (prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`))) {
      delete next[key];
      changed = true;
    }
  }
  return changed ? next : current;
}

function orderDraftSchema(options: { requirePackages: boolean }) {
  return quoteOrderSchema.superRefine((order, ctx) => {
    if (order.lines.filter(filledLine).length === 0) {
      ctx.addIssue({ code: "custom", message: "Nhập ít nhất một dòng hàng", path: ["lines"] });
    }
    if (options.requirePackages) {
      order.lines.forEach((line, index) => {
        if (!filledLine(line) || line.packages.length > 0) return;
        ctx.addIssue({
          code: "custom",
          message: "Nhập quy cách đóng gói (số kiện, kích thước, kg/kiện)",
          path: ["lines", index, "packages"],
        });
      });
    }
  });
}

function InputError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="max-w-44 text-xs text-danger">{message}</p>;
}

/** Chọn tỷ giá = chọn loại tiền chính của đơn, áp dụng cho mọi dòng. Giá đã nhập giữ nguyên, không quy đổi. */
function selectRateColumn(order: QuoteOrder, currency: string): QuoteOrder {
  if (order.currency === currency && (order.priceColumns ?? []).length === 0) return order;
  return {
    ...order,
    currency,
    rate: null,
    priceColumns: (order.priceColumns ?? []).filter((column) => column.currency !== currency),
    lines: order.lines.map((line) => ({ ...line, prices: (line.prices ?? []).filter((item) => item.currency !== currency) })),
  };
}

function PriceColumnPicker({
  orders,
  disabled,
  onSelect,
}: {
  orders: QuoteOrder[];
  disabled?: boolean;
  onSelect: (currency: string) => void;
}) {
  const selected = orders[0]?.currency || "VND";
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">Tỷ giá</span>
      <NativeSelect className="h-9 w-44" aria-label="Tỷ giá" disabled={disabled} value={selected} onChange={(event) => onSelect(event.target.value)}>
        {quoteCurrencies.map((code) => (
          <option key={code} value={code}>{code}</option>
        ))}
      </NativeSelect>
    </label>
  );
}

function safeImage(value: string): string {
  if (value.startsWith("data:image/") || value.startsWith("https://")) return value;
  return "";
}

function useDraftString<T extends HTMLInputElement | HTMLTextAreaElement>(value: string, onValueChange: (value: string) => void) {
  const [text, setText] = useState(value);
  const textRef = useRef(value);
  const externalRef = useRef(value);
  const commitRef = useRef(onValueChange);
  const fieldRef = useRef<T>(null);
  externalRef.current = value;
  commitRef.current = onValueChange;
  const write = (next: string) => {
    textRef.current = next;
    setText(next);
    if (next !== externalRef.current) commitRef.current(next);
  };
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const commit = () => {
      if (textRef.current !== externalRef.current) commitRef.current(textRef.current);
    };
    field.addEventListener("blur", commit);
    return () => field.removeEventListener("blur", commit);
  }, []);
  useEffect(() => {
    if (fieldRef.current && document.activeElement !== fieldRef.current) write(value);
    // Chỉ đồng bộ khi dữ liệu bên ngoài đổi, không ghi đè chữ đang gõ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return {
    ref: fieldRef,
    value: text,
    onValueChange: write,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => write(event.target.value),
  };
}

function DraftText({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const draft = useDraftString<HTMLInputElement>(value, onValueChange);
  return <Input {...props} ref={draft.ref} value={draft.value} onChange={draft.onChange} {...({ onValueChange: draft.onValueChange } as Record<string, unknown>)} />;
}

function DraftArea({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const draft = useDraftString<HTMLTextAreaElement>(value, onValueChange);
  return <Textarea {...props} ref={draft.ref} value={draft.value} onChange={draft.onChange} />;
}

function DraftQuantity({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
}) {
  const shown = amountText(value);
  const [text, setText] = useState(shown);
  const textRef = useRef(shown);
  const externalRef = useRef(shown);
  const commitRef = useRef(onValueChange);
  const fieldRef = useRef<HTMLInputElement>(null);
  externalRef.current = shown;
  commitRef.current = onValueChange;
  const write = (next: string) => {
    textRef.current = next;
    setText(next);
    const parsed = amountValue(next);
    if (parsed !== value) commitRef.current(parsed);
  };
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const commit = () => commitRef.current(amountValue(textRef.current));
    field.addEventListener("blur", commit);
    return () => field.removeEventListener("blur", commit);
  }, []);
  useEffect(() => {
    if (fieldRef.current && document.activeElement !== fieldRef.current) write(shown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  return (
    <Input
      {...props}
      ref={fieldRef}
      inputMode="decimal"
      value={text}
      onChange={(event) => write(event.target.value)}
      {...({ onValueChange: write } as Record<string, unknown>)}
    />
  );
}

const OrderLines = memo(function OrderLines({
  lines,
  shippingMode,
  currency,
  columns,
  canEditContent,
  canEditPricing,
  packagingRequired,
  canEditPackaging,
  errors = {},
  onChange,
  onError,
  onClearError,
  lang = "vi",
  showPricing = true,
  brief = false,
  pureLogistics = false,
}: {
  lines: QuoteLine[];
  shippingMode: "AIR" | "SEA" | null;
  currency: QuoteCurrency;
  columns: PriceColumn[];
  canEditContent: boolean;
  canEditPricing: boolean;
  packagingRequired: boolean;
  canEditPackaging: boolean;
  errors?: Record<string, string>;
  onChange: (lines: QuoteLine[] | ((current: QuoteLine[]) => QuoteLine[])) => void;
  onError: (message: string) => void;
  onClearError?: (key: string) => void;
  /** Ngôn ngữ nội dung chữ đang sửa (quy cách, thuộc tính, ghi chú). */
  lang?: QuoteLang;
  /** Ẩn cột đơn giá và thành tiền khi người đang sửa không phải người định giá. */
  showPricing?: boolean;
  /** Sale tìm hàng: chỉ mặt hàng, hình ảnh, số lượng, quy cách. */
  brief?: boolean;
  pureLogistics?: boolean;
}) {
  const priceColumns = !showPricing ? [] : columns.length > 0 ? columns : [{ currency }];
  const visibleAttrKeys = pureLogistics ? logisticsAttrKeys : factoryAttrKeys;
  const updateLine = (index: number, patch: Partial<QuoteLine>) => {
    onChange((lines) => lines.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      let next = { ...line, ...patch, prices: patch.prices ?? line.prices ?? [] };
      if (("packages" in patch || "quantity" in patch) && next.packages.length > 0) {
        const m = packageMetrics(next.packages, shippingMode);
        const quantity = next.quantity && next.quantity > 0 ? next.quantity : 1;
        next = { ...next, cbm: m.cbm / quantity, weightKg: m.chargeableKg / quantity };
      }
      if (["quantity", "pricePerSet", "basis", "packages", "weightKg", "cbm", "areaM2", "lineTotalManual"].some((k) => k in patch)) next = recalcLine(next);
      return next;
    }));
  };

  const updateColumnPrice = (index: number, column: string, pricePerSet: number | null) => {
    if (column === currency) {
      updateLine(index, { pricePerSet });
      return;
    }
    const line = lines[index];
    if (!line) return;
    updateLine(index, { prices: withCurrencyPrice(line, currency, column, pricePerSet).prices });
  };

  const addLine = () => {
    onChange((lines) => {
      const numbers = lines.map((line) => Number(line.stt)).filter((value) => Number.isFinite(value) && value > 0);
      const next = numbers.length ? Math.max(...numbers) + 1 : lines.length + 1;
      return [...lines, emptyLine(String(next))];
    });
  };

  const addImages = (index: number, line: QuoteLine, incoming: string[]) => {
    const current = quoteLineImages(line);
    const room = 8 - current.length;
    if (room <= 0) {
      onError("Tối đa 8 ảnh mỗi dòng");
      return;
    }
    updateLine(index, withImages([...current, ...incoming.slice(0, room)]));
  };

  return (
    <div className="grid gap-3">
      <InputError message={errors.lines} />
      <TableHScroll className="rounded-lg">
        <table className="w-full min-w-[980px] text-base">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-sm">
              {!brief && <th className="whitespace-nowrap px-2 py-3 font-medium">STT</th>}
              <th className="min-w-[180px] whitespace-nowrap px-2 py-3 font-medium">Mặt hàng</th>
              <th className="min-w-[160px] whitespace-nowrap px-2 py-3 font-medium">Hình ảnh</th>
              <th className="whitespace-nowrap px-2 py-3 font-medium">Số lượng</th>
              {showPricing && <th className="whitespace-nowrap px-2 py-3 font-medium">Kg/CBM/m2</th>}
              {priceColumns.map((column) => (
                <th key={`price-${column.currency}`} className="whitespace-nowrap px-2 py-3 font-medium">Đơn giá ({column.currency})</th>
              ))}
              {priceColumns.map((column) => (
                <th key={`total-${column.currency}`} className="whitespace-nowrap px-2 py-3 font-medium">Thành tiền ({column.currency})</th>
              ))}
              {!pureLogistics && <th className="min-w-[120px] whitespace-nowrap px-2 py-3 font-medium">Quy cách</th>}
              {!brief && <th className="min-w-[220px] whitespace-nowrap px-2 py-3 font-medium">{pureLogistics ? "Thông tin hàng hóa" : "Thuộc tính xưởng"}</th>}
              <th className="min-w-[140px] whitespace-nowrap px-2 py-3 font-medium">{brief ? "Lưu ý" : "Note"}</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const images = quoteLineImages(line);
              return (
                <tr key={index} className="border-b align-top last:border-0">
                  {!brief && <td className="px-2 py-2">
                    <Input className="h-8 w-12" aria-label={`STT dòng ${index + 1}`} value={line.stt} disabled={!canEditContent} onChange={(event) => updateLine(index, { stt: event.target.value })} />
                  </td>}
                  <td className="px-2 py-2">
                    <DraftText className="h-8 w-44" aria-label={`Mặt hàng dòng ${index + 1}`} value={line.productName ?? ""} disabled={!canEditContent} onValueChange={(productName) => updateLine(index, { productName })} placeholder="Tên mặt hàng" />
                  </td>
                  <td className="px-2 py-2">
                    <div
                      tabIndex={canEditContent ? 0 : undefined}
                      className="flex max-w-[220px] flex-col gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Ảnh dòng ${index + 1}`}
                      onCopy={(event) => {
                        const image = images.map(safeImage).find(Boolean);
                        if (!image || !event.clipboardData) return;
                        event.preventDefault();
                        event.clipboardData.setData("text/plain", image);
                      }}
                      onPaste={(event) => {
                        if (!canEditContent) return;
                        const pasted = clipboardImage(event);
                        if (!pasted) return;
                        event.preventDefault();
                        if (images.length >= 8) {
                          onError("Tối đa 8 ảnh mỗi dòng");
                          return;
                        }
                        if (typeof pasted === "string") {
                          if (pasted.length > 100_000) {
                            onError("Ảnh quá lớn, hãy chọn ảnh nhỏ hơn");
                            return;
                          }
                          void uploadDataImage(pasted)
                            .then((image) => addImages(index, line, [image]))
                            .catch((err: unknown) => onError(err instanceof Error ? err.message : "Không tải được ảnh"));
                          return;
                        }
                        void uploadImageFile(pasted)
                          .then((image) => addImages(index, line, [image]))
                          .catch((err: unknown) => onError(err instanceof Error ? err.message : "Không tải được ảnh"));
                      }}
                    >
                      <div className="flex flex-wrap gap-1">
                        {images.map((image, imageIndex) => {
                          const src = safeImage(image);
                          if (!src) return null;
                          return (
                            <div key={`${imageIndex}-${src.slice(0, 24)}`} className="relative">
                              <img src={src} alt="" className="h-16 w-16 rounded border bg-white object-contain" />
                              {canEditContent && (
                                <Button
                                  type="button"
                                  size="icon-xs"
                                  variant="destructive"
                                  className="absolute -right-1 -top-1"
                                  aria-label={`Xóa ảnh ${imageIndex + 1} dòng ${index + 1}`}
                                  onClick={() => updateLine(index, withImages(images.filter((_, i) => i !== imageIndex)))}
                                >
                                  <Trash2 />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <InputError message={errors[`line.${index}.images`]} />
                      {canEditContent && images.length < 8 && (
                        <label className="inline-flex h-7 w-fit cursor-pointer items-center gap-1 rounded-md border px-2 text-[11px] hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
                          <ImagePlus aria-hidden className="size-3" />
                          Thêm
                          <input
                            className="sr-only"
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            aria-label={`Tải nhiều ảnh dòng ${index + 1}`}
                            onChange={(event) => {
                              const files = Array.from(event.target.files ?? []);
                              event.target.value = "";
                              if (files.length === 0) return;
                              const room = 8 - images.length;
                              if (room <= 0) {
                                onError("Tối đa 8 ảnh mỗi dòng");
                                return;
                              }
                              void uploadImageFiles(files.slice(0, room))
                                .then((next) => addImages(index, line, next))
                                .catch((err: unknown) => onError(err instanceof Error ? err.message : "Không tải được ảnh"));
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="grid w-[5.5rem] gap-1">
                      <DraftQuantity className="h-8" aria-label={`Số lượng dòng ${index + 1}`} aria-invalid={errors[`line.${index}.quantity`] ? true : undefined} value={line.quantity} disabled={!canEditContent} onValueChange={(quantity) => { updateLine(index, { quantity }); onClearError?.(`line.${index}.quantity`); }} placeholder="SL" />
                      <InputError message={errors[`line.${index}.quantity`]} />
                      {!brief && <Input className="h-8" aria-label={`Đơn vị dòng ${index + 1}`} aria-invalid={errors[`line.${index}.unit`] ? true : undefined} value={line.unit} disabled={!canEditContent} onChange={(event) => { updateLine(index, { unit: event.target.value }); onClearError?.(`line.${index}.unit`); }} placeholder="ĐV" />}
                      {!brief && <InputError message={errors[`line.${index}.unit`]} />}
                    </div>
                  </td>
                  {showPricing && <td className="px-2 py-2">
                    <div className="grid w-28 gap-1">
                      <NativeSelect className="h-8 text-xs" aria-label={`Cách tính giá dòng ${index + 1}`} value={line.basis} disabled={!canEditPricing} onChange={(event) => updateLine(index, { basis: event.target.value as PricingBasis })}>
                        {(Object.keys(pricingBasisLabels) as PricingBasis[]).map((b) => <option key={b} value={b}>{pricingBasisLabels[b]}</option>)}
                      </NativeSelect>
                      <BasisMetricInput className="h-8" line={line} index={index} disabled={!canEditContent && !canEditPricing} onChange={(patch) => updateLine(index, patch)} />
                    </div>
                  </td>}
                  {priceColumns.map((column) => {
                    const amount = lineCurrencyPrice(line, currency, column.currency);
                    return (
                      <td key={`price-${column.currency}`} className="px-2 py-2">
                        <div className="grid w-36 gap-1">
                          <MoneyInput className="h-8" fractionDigits={3} aria-label={`Đơn giá ${column.currency} dòng ${index + 1}`} aria-invalid={errors[`line.${index}.price.${column.currency}`] ? true : undefined} value={amount.price} disabled={!canEditPricing} onValueChange={(pricePerSet) => { updateColumnPrice(index, column.currency, pricePerSet); onClearError?.(`line.${index}.price.${column.currency}`); }} />
                          <InputError message={errors[`line.${index}.price.${column.currency}`]} />
                        </div>
                      </td>
                    );
                  })}
                  {priceColumns.map((column) => {
                    const amount = lineCurrencyPrice(line, currency, column.currency);
                    const primary = column.currency === currency;
                    return (
                      <td key={`total-${column.currency}`} className="px-2 py-2">
                        <div className="grid gap-1">
                        <MoneyInput className="h-8 w-32" fractionDigits={3} aria-label={`Thành tiền ${column.currency} dòng ${index + 1}`} aria-invalid={errors[`line.${index}.total.${column.currency}`] ? true : undefined} value={amount.total} disabled={!canEditPricing} onValueChange={(lineTotal) => { onClearError?.(`line.${index}.total.${column.currency}`);
                          const formula = lineAmount({ basis: line.basis, quantity: line.quantity, price: amount.price, weightKg: line.weightKg, cbm: line.cbm, areaM2: line.areaM2 });
                          const manual = lineTotal !== formula;
                          if (primary) {
                            updateLine(index, { lineTotal: manual ? lineTotal : formula, lineTotalManual: manual });
                            return;
                          }
                          const prices = [...(line.prices ?? []).filter((item) => item.currency !== column.currency), { currency: column.currency, pricePerSet: amount.price, lineTotal: manual ? lineTotal : formula, lineTotalManual: manual }];
                          updateLine(index, { prices });
                        }} />
                        {amount.totalManual && canEditPricing && (
                          <button type="button" className="text-left text-[11px] text-primary underline" onClick={() => {
                            if (primary) {
                              updateLine(index, { lineTotalManual: false });
                              return;
                            }
                            const formula = lineAmount({ basis: line.basis, quantity: line.quantity, price: amount.price, weightKg: line.weightKg, cbm: line.cbm, areaM2: line.areaM2 });
                            const prices = [...(line.prices ?? []).filter((item) => item.currency !== column.currency), { currency: column.currency, pricePerSet: amount.price, lineTotal: formula, lineTotalManual: false }];
                            updateLine(index, { prices });
                          }}>Tính lại</button>
                        )}
                        <InputError message={errors[`line.${index}.total.${column.currency}`]} />
                        </div>
                      </td>
                    );
                  })}
                  {!pureLogistics && <td className="px-2 py-2">
                    <DraftArea className="min-h-16 w-36" aria-label={`Quy cách dòng ${index + 1}`} aria-invalid={errors[`line.${index}.spec`] ? true : undefined} value={lang === "en" ? line.specEn : line.spec} disabled={!canEditContent} onValueChange={(next) => { updateLine(index, lang === "en" ? { specEn: next } : { spec: next }); onClearError?.(`line.${index}.spec`); }} placeholder={lang === "en" ? line.spec || "Specification" : "Quy cách"} />
                    <InputError message={errors[`line.${index}.spec`]} />
                  </td>}
                  {!brief && <td className="px-2 py-2">
                    <div className="grid w-[14.5rem] grid-cols-2 gap-1.5">
                      {visibleAttrKeys.map((key) => (
                        <Input
                          key={key}
                          className="h-8 text-xs"
                          aria-label={`${key} dòng ${index + 1}`}
                          value={attrValue(line.attrs, key, lang)}
                          disabled={!canEditContent}
                          onChange={(event) => updateLine(index, { attrs: withAttr(line.attrs, key, event.target.value, lang) })}
                          placeholder={lang === "en" ? quoteAttrKeyEn[key] ?? key : key}
                        />
                      ))}
                    </div>
                  </td>}
                  <td className="px-2 py-2">
                    <DraftArea className="min-h-16 w-40" aria-label={`Lưu ý dòng ${index + 1}`} aria-invalid={errors[`line.${index}.note`] ? true : undefined} value={lang === "en" ? line.noteEn : line.note} disabled={!canEditContent} onValueChange={(next) => { updateLine(index, lang === "en" ? { noteEn: next } : { note: next }); onClearError?.(`line.${index}.note`); }} placeholder={lang === "en" ? line.note || "Note" : "Lưu ý"} />
                    <InputError message={errors[`line.${index}.note`]} />
                  </td>
                  <td className="px-2 py-2">
                    {canEditContent && (
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Xóa dòng ${index + 1}`} onClick={() => onChange((lines) => lines.filter((_, lineIndex) => lineIndex !== index))}>
                        <Trash2 />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableHScroll>
      {!brief && lines.map((line, index) => (
        <div key={index} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-2">
          {packagingRequired && (
            <LinePackagesEditor
              line={line}
              shippingMode={shippingMode}
              lineLabel={`STT ${line.stt || index + 1}`}
              canEdit={canEditPackaging}
              error={errors[`line.${index}.packages`]}
              fieldError={(packageIndex, key) => errors[`line.${index}.package.${packageIndex}.${key}`]}
              onChange={(packages) => {
                updateLine(index, { packages });
                onClearError?.(`line.${index}.packages`);
                onClearError?.(`line.${index}.package`);
              }}
            />
          )}
          <div className="grid content-start gap-2">
            <label className="grid gap-2 text-sm">
              <span>{`${pureLogistics ? "Cân tính cước (kg/đơn vị hàng)" : "Trọng lượng (kg)"} · STT ${line.stt || index + 1}`}</span>
              <DraftQuantity aria-invalid={errors[`line.${index}.weight`] ? true : undefined} value={line.weightKg} disabled={!canEditContent} onValueChange={(weightKg) => { updateLine(index, { weightKg }); onClearError?.(`line.${index}.weight`); }} />
              <InputError message={errors[`line.${index}.weight`]} />
            </label>
            <p className="text-sm font-medium">{pureLogistics ? "Thông tin hàng hóa khác" : "Thuộc tính xưởng khác"}</p>
            {line.attrs.map((attr, attrIndex) => factoryAttrKeys.some((key) => key === attr.key) ? null : (
              <div key={attrIndex} className="flex items-center gap-1">
                <Input aria-label={`Tên thuộc tính ${attrIndex + 1} dòng ${index + 1}`} value={lang === "en" ? attr.keyEn : attr.key} placeholder={lang === "en" ? attr.key : undefined} disabled={!canEditContent} onChange={(event) => updateLine(index, { attrs: line.attrs.map((item, i) => i === attrIndex ? { ...item, ...(lang === "en" ? { keyEn: event.target.value } : { key: event.target.value }) } : item) })} />
                <Input aria-label={`Giá trị thuộc tính ${attrIndex + 1} dòng ${index + 1}`} value={lang === "en" ? attr.valueEn : attr.value} placeholder={lang === "en" ? attr.value : undefined} disabled={!canEditContent} onChange={(event) => updateLine(index, { attrs: line.attrs.map((item, i) => i === attrIndex ? { ...item, ...(lang === "en" ? { valueEn: event.target.value } : { value: event.target.value }) } : item) })} />
                {canEditContent && <Button type="button" size="icon-sm" variant="ghost" aria-label="Xóa thuộc tính" onClick={() => updateLine(index, { attrs: line.attrs.filter((_, i) => i !== attrIndex) })}><Trash2 /></Button>}
              </div>
            ))}
            {canEditContent && <Button type="button" variant="outline" className="w-fit" onClick={() => updateLine(index, { attrs: [...line.attrs, { key: "", value: "", keyEn: "", valueEn: "" }] })}><Plus />Thêm thuộc tính</Button>}
          </div>
        </div>
      ))}
      {canEditContent && (
        <Button type="button" variant="outline" onClick={addLine}>
          <Plus />Thêm dòng
        </Button>
      )}
    </div>
  );
});

export type QuoteEditMode = "none" | "content" | "full";

function QuoteStepNotes({
  initial,
  draftRef,
  fieldId,
}: {
  initial: SaleLeadDraft;
  draftRef: { current: SaleLeadDraft | null };
  fieldId: (name: string) => string;
}) {
  const [local, setLocal] = useState(initial);
  const write = (next: SaleLeadDraft) => {
    draftRef.current = next;
    setLocal(next);
  };
  return (
    <section className="grid gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Lưu ý</h3>
      <Field label="Yêu cầu của khách" htmlFor={fieldId("quote-step-requirements")}>
        <Textarea id={fieldId("quote-step-requirements")} rows={4} value={local.requirements} onChange={(event) => write({ ...local, requirements: event.target.value })} placeholder="Chi tiết hàng hóa, hạn giao, lưu ý…" />
      </Field>
      <Field label="Ghi chú sale" htmlFor={fieldId("quote-step-note")}>
        <Textarea id={fieldId("quote-step-note")} rows={3} value={local.saleNote} onChange={(event) => write({ ...local, saleNote: event.target.value })} />
      </Field>
    </section>
  );
}

function OrderDraftDialog({
  mode: initialMode,
  order: initialOrder,
  shippingMode,
  pending,
  sourcingSale,
  pureLogistics,
  saleLogisticsOrder,
  showPackaging,
  canEditContent,
  canEditOrderPrices,
  canEditPackaging,
  packagesOptional = false,
  printLang,
  quoteCode,
  fieldId,
  pdfPending,
  previewHtml,
  onClose,
  onPersist,
  onOutput,
}: {
  mode: "create" | "edit" | "view";
  order: QuoteOrder;
  shippingMode: "AIR" | "SEA" | null;
  pending: boolean;
  sourcingSale: boolean;
  pureLogistics: boolean;
  saleLogisticsOrder: boolean;
  showPackaging: boolean;
  canEditContent: boolean;
  canEditOrderPrices: boolean;
  canEditPackaging: boolean;
  /** Nháp trên mess: chưa biết đường bay/biển/FCL nên không bắt buộc đóng gói; bước báo giá và lúc chuyển sẽ kiểm tra. */
  packagesOptional?: boolean;
  printLang: QuoteLang;
  quoteCode: string;
  fieldId: (name: string) => string;
  pdfPending: boolean;
  previewHtml: string;
  onClose: () => void;
  onPersist: (order: QuoteOrder) => Promise<boolean>;
  onOutput: (action: "print" | "pdf" | "excel", order: QuoteOrder) => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [order, setOrderState] = useState(initialOrder);
  const orderRef = useRef(order);
  const commitOrder = useCallback((next: QuoteOrder) => {
    orderRef.current = next;
    setOrderState(next);
  }, []);
  const commitLines = useCallback((update: QuoteLine[] | ((current: QuoteLine[]) => QuoteLine[])) => {
    const lines = typeof update === "function" ? update(orderRef.current.lines) : update;
    commitOrder({ ...orderRef.current, lines });
  }, [commitOrder]);
  const [orderError, setOrderError] = useState<string>();
  const [orderFields, setOrderFields] = useState<Record<string, string>>({});
  const clearOrderField = useCallback((key: string) => {
    setOrderFields((current) => withoutOrderFields(current, [key]));
  }, []);
  const save = async () => {
    if (mode === "view") return;
    const current = orderRef.current;
    const requirePackages = Boolean(!sourcingSale && !packagesOptional && (saleLogisticsOrder || showPackaging));
    const named = sourcingSale && !current.name.trim()
      ? { ...current, name: current.lines.find((line) => line.productName?.trim())?.productName?.trim() || "Đơn tìm hàng" }
      : current;
    const parsed = orderDraftSchema({ requirePackages }).safeParse(named);
    if (!parsed.success) {
      const { fields, rest } = orderIssueFields(named, parsed.error.issues);
      setOrderFields(fields);
      setOrderError(rest[0]);
      queueMicrotask(() => {
        document.querySelector('[role="dialog"] [aria-invalid="true"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      return;
    }
    const data = { ...parsed.data, lines: parsed.data.lines.filter(filledLine) };
    if (await onPersist(data)) onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="z-[80] max-h-[96dvh] w-[min(96vw,90rem)] max-w-none flex-col sm:max-w-none"
        style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {mode === "create" ? "Tạo thông tin đơn hàng" : mode === "edit" ? "Sửa thông tin đơn hàng" : "Xem thông tin đơn hàng"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1">
          {orderError && <InlineAlert>{orderError}</InlineAlert>}
          {mode !== "view" && !pureLogistics && !saleLogisticsOrder && (
            <InlineAlert>
              {sourcingSale
                ? "Sale nhập mặt hàng, hình ảnh, số lượng, quy cách và lưu ý, rồi bấm Chuyển Sourcing."
                : "Sourcing điền ảnh, số lượng, quy cách, đóng gói và đơn giá hàng. Logistics chỉ nhập chi phí logistics."}
            </InlineAlert>
          )}
          {!sourcingSale && <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4">
            <Field label="Tên thông tin đơn hàng" htmlFor={fieldId("order-name")} error={orderFields.name} required>
              <DraftText
                id={fieldId("order-name")}
                value={order.name}
                disabled={mode === "view"}
                onValueChange={(name) => {
                  commitOrder({ ...orderRef.current, name });
                  clearOrderField("name");
                }}
                placeholder="VD: Mẫu A — 500 set"
              />
            </Field>
          </div>}
          {mode === "view" ? (
            <QuoteSheetPreview html={previewHtml} title={`Xem trước ${order.name || quoteCode}`} />
          ) : (
            <>
              {!pureLogistics && !sourcingSale && (
                <div className="flex flex-wrap items-center gap-2">
                    <PriceColumnPicker
                      orders={[order]}
                      disabled={!canEditOrderPrices}
                      onSelect={(currency) => commitOrder(selectRateColumn(orderRef.current, currency))}
                    />
                </div>
              )}
              <OrderLines
                lang={printLang}
                shippingMode={shippingMode}
                showPricing={!pureLogistics && !sourcingSale}
                lines={order.lines}
                currency={order.currency}
                columns={columnsFor(order)}
                canEditContent={canEditContent}
                canEditPricing={canEditOrderPrices}
                brief={sourcingSale}
                pureLogistics={pureLogistics}
                packagingRequired={!sourcingSale && !packagesOptional && (saleLogisticsOrder || showPackaging)}
                canEditPackaging={canEditPackaging}
                errors={orderFields}
                onChange={commitLines}
                onError={setOrderError}
                onClearError={clearOrderField}
              />
            </>
          )}
        </div>
        <DialogFooter className="shrink-0">
          {mode === "view" && (
            <>
              <Button type="button" variant="outline" onClick={() => onOutput("print", order)}><Printer />In</Button>
              <Button type="button" variant="outline" disabled={pdfPending} onClick={() => onOutput("pdf", order)}>
                <Download />{pdfPending ? "Đang tải…" : "Tải PDF"}
              </Button>
              <Button type="button" variant="outline" disabled={pdfPending} onClick={() => onOutput("excel", order)}>
                <Download />Tải Excel
              </Button>
              {canEditContent && (
                <Button type="button" variant="outline" disabled={pending} onClick={() => { setOrderError(undefined); setOrderFields({}); setMode("edit"); }}>
                  <Pencil />Sửa
                </Button>
              )}
            </>
          )}
          <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
          {mode !== "view" && <Button type="button" disabled={pending} onClick={() => void save()}>{pending ? "Đang lưu…" : "Lưu"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sale nhập nháp thông tin sản phẩm/đơn hàng ngay trên mess, trước khi bấm Chuyển.
 * Dùng lại form đơn hàng của bước báo giá: Tìm hàng nhập mặt hàng/ảnh/số lượng, Vận chuyển nhập thêm quy cách đóng gói. Sale không nhập giá.
 */
/** Nháp đơn hàng trên mess: cùng một form cho Tìm hàng lẫn Vận chuyển (cân tính cước, thông tin hàng hóa). Đóng gói không bắt buộc ở nháp, bước chuyển sẽ kiểm tra. */
export function MessOrderDialog({
  order,
  onClose,
  onSave,
}: {
  order: QuoteOrder | null;
  onClose: () => void;
  onSave: (order: QuoteOrder) => void;
}) {
  const [initial] = useState<QuoteOrder>(() => order ?? {
    id: crypto.randomUUID(),
    name: "",
    selected: true,
    currency: "VND",
    rate: null,
    priceColumns: [],
    lines: [emptyLine("1")],
  });
  return (
    <OrderDraftDialog
      mode={order ? "edit" : "create"}
      order={initial}
      shippingMode={null}
      pending={false}
      sourcingSale={false}
      pureLogistics
      saleLogisticsOrder
      showPackaging
      canEditContent
      canEditOrderPrices={false}
      canEditPackaging
      packagesOptional
      printLang="vi"
      quoteCode=""
      fieldId={(name) => `mess-order-${name}`}
      pdfPending={false}
      previewHtml=""
      onClose={onClose}
      onPersist={async (next) => { onSave({ ...next, selected: true }); return true; }}
      onOutput={() => undefined}
    />
  );
}

export function QuoteEditor({
  quote,
  templates,
  canEdit = false,
  editMode,
  pending,
  error,
  onClose,
  onSave,
  onSaveSale,
  onSend,
  onReturn,
  embedded = false,
  heading,
  allowContract = false,
  lane,
  onContractCreated,
  desk,
  onContinueLogistics,
  onHandoffLogistics,
  onHandoffSourcing,
  saleOrder = false,
  quoteStep = false,
}: {
  quote: QuoteRecord;
  templates: QuoteTemplateRecord[];
  /** @deprecated Dùng editMode. true = full, false = none. */
  canEdit?: boolean;
  editMode?: QuoteEditMode;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSave: (input: UpdateQuoteInput, options?: { close?: boolean }) => Promise<boolean>;
  /** Lưu thông tin khách tiềm năng ngay trên tab Sale. */
  onSaveSale?: (input: UpdatePotentialInput) => Promise<Partial<QuoteRecord> | null>;
  onSend?: (input: UpdateQuoteInput) => Promise<string | null>;
  onReturn?: () => Promise<string | null>;
  embedded?: boolean;
  heading?: string;
  allowContract?: boolean;
  lane?: CrmLane;
  onContractCreated?: () => void;
  desk?: "sourcing" | "logistics";
  /** Sau khi gửi báo giá sourcing xong (KH sourcing+logistics), chuyển sang bàn logistics. */
  onContinueLogistics?: () => Promise<boolean>;
  /** Sale nhập đơn hàng thuần logistics rồi chuyển cho bàn Logistics. */
  onHandoffLogistics?: () => Promise<boolean>;
  /** Sale nhập mặt hàng tìm hàng rồi chuyển cho bàn Sourcing. */
  onHandoffSourcing?: () => Promise<boolean>;
  /** Sale được sửa thông tin đơn trên báo giá thuần logistics. */
  saleOrder?: boolean;
  /** Bước báo giá ngay sau khi chuyển mess: chỉ điền đơn, không sửa hồ sơ khách. */
  quoteStep?: boolean;
}) {
  const mode: QuoteEditMode = editMode ?? (canEdit ? "full" : "none");
  const pureLogistics = quote.customerKind === "LOGISTICS";
  const showPackaging = desk === "sourcing" || desk === "logistics" || !isCombinedSourcing(quote);
  const canSendQuote = mode === "full";
  const canEditLogisticsFees = mode === "full" && desk === "logistics";
  const sourcingSale = quote.customerKind === "SOURCING" && (saleOrder || Boolean(onHandoffSourcing));
  const saleLogisticsOrder = quote.customerKind === "LOGISTICS" && (saleOrder || Boolean(onHandoffLogistics));
  const saleFill = sourcingSale || saleLogisticsOrder;
  const canEditContent = pureLogistics
    ? mode === "content" || (saleOrder && mode !== "none")
    : (saleFill || desk !== "logistics") && (mode === "content" || mode === "full");
  const canEditPricing = mode === "full" && desk !== "logistics";
  /** Khách thuần logistics: Logistics (bàn logistics, quyền đầy đủ) định giá; Sale chỉ nhập nội dung đơn. */
  const canPriceAsLogistics = mode === "full" && desk === "logistics";
  const canEditOrderPrices = pureLogistics ? canPriceAsLogistics : canEditPricing;
  const canEditPackaging = sourcingSale ? false : pureLogistics ? canEditContent : (saleFill && canEditContent) || (canEditContent && canEditPricing);
  const canEditSaleNotes = pureLogistics || saleFill ? canEditContent : canEditPricing;
  /** Số ngày hiệu lực do bàn gửi báo giá nhập: Sourcing ở bàn sourcing, Logistics ở bàn logistics. Sale không sửa. */
  const canEditValidity = mode === "full";
  const [lead, setLead] = useState(quote);
  const isFcl = pureLogistics && lead.shippingMode === "SEA" && lead.logisticsClass === "FCL";
  const [editingSale, setEditingSale] = useState(false);
  const [saleDraft, setSaleDraft] = useState<SaleLeadDraft | null>(null);
  const [saleError, setSaleError] = useState<string>();
  const [salePending, setSalePending] = useState(false);
  const [templateId, setTemplateId] = useState(quote.templateId ?? "");
  const [opsNote, setOpsNote] = useState(quote.opsNote ?? "");
  const [quoteStatus, setQuoteStatus] = useState<(typeof quoteStatusOptions)[number][0]>(
    quoteStatusOptions.some((item) => item[0] === quote.quoteStatus) ? quote.quoteStatus as (typeof quoteStatusOptions)[number][0] : "CHUA_CO_BAO_GIA",
  );
  const [contractStatus, setContractStatus] = useState<(typeof contractStatusOptions)[number][0]>(
    contractStatusOptions.some((item) => item[0] === quote.contractStatus) ? quote.contractStatus as (typeof contractStatusOptions)[number][0] : "CHUA_TAO",
  );
  const [orders, setOrders] = useState<QuoteOrder[]>(quote.orders);
  const [notes, setNotes] = useState<QuoteNotes>({
    ...quote.notes,
    shippingLabel: quote.notes.shippingLabel ?? "",
    logisticsFees: quote.notes.logisticsFees ?? [],
    opsExtra: quote.notes.opsExtra ?? "",
  });
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const commitNotes = useCallback((next: QuoteNotes) => {
    notesRef.current = next;
    setNotes(next);
  }, []);
  const [bank, setBank] = useState<QuoteBank>(quote.bank);
  const [formError, setFormError] = useState<string>();
  const [draft, setDraft] = useState<{ mode: "create" | "edit" | "view"; order: QuoteOrder } | null>(null);
  const saleDraftRef = useRef<SaleLeadDraft | null>(null);
  const [removing, setRemoving] = useState<QuoteOrder | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [logisticsHandoff, setLogisticsHandoff] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);
  const sent = quoteStatus === "DA_CO_BAO_GIA" || quoteStatus === "DA_CO_BAO_GIA_LAI";
  /** Đang điều chỉnh (Sale trả về) thì chưa có hạn mới: hạn sẽ đếm lại khi gửi lại. */
  const validity = quoteStatus === "CHUA_CO_BAO_GIA_LAI" ? null : quoteValidity(quote.sentQuote);
  const needsNewQuote = quoteStatus === "CHUA_CO_BAO_GIA_LAI";
  const fieldId = (name: string) => (embedded ? `${quote.id}-${name}` : name);

  /** Ô số ngày hiệu lực. Sourcing nhập ở tab Sourcing, Logistics nhập ở tab Logistics (mỗi bàn một báo giá riêng). */
  const validityField = (name: string) => (
    <Field label="Hiệu lực báo giá (ngày)" htmlFor={fieldId(name)}>
      <Input
        id={fieldId(name)}
        type="number"
        inputMode="numeric"
        min={1}
        max={365}
        step={1}
        value={notes.validityDays ?? ""}
        disabled={!canEditValidity}
        onChange={(event) => {
          const raw = event.target.value.trim();
          commitNotes({ ...notesRef.current, validityDays: raw === "" ? null : Math.trunc(Number(raw)) });
        }}
        placeholder="Ví dụ: 7"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {validity
          ? validity.expired
            ? `Đã gửi ${formatQuoteDay(validity.sentOn)} · đã hết hạn từ ${formatQuoteDay(validity.expiresOn)}. Gửi lại báo giá để đếm lại.`
            : `Đã gửi ${formatQuoteDay(validity.sentOn)} · hết hạn ${formatQuoteDay(validity.expiresOn)} (còn ${validity.remainingDays} ngày).`
          : "Tính từ ngày gửi báo giá. Điều chỉnh và gửi lại thì đếm lại từ đầu."}
      </p>
    </Field>
  );

  const canSaveSale = Boolean(onSaveSale) && (desk !== "logistics" || pureLogistics);

  useEffect(() => {
    setLead(quote);
  }, [quote]);

  const seededLogisticsOrder = useRef<string | null>(null);
  useEffect(() => {
    if (desk !== "logistics" || quote.orders.length > 0 || !quote.sourcingContext?.order) return;
    if (seededLogisticsOrder.current === quote.id) return;
    seededLogisticsOrder.current = quote.id;
    setOrders([{ ...quote.sourcingContext.order, selected: true }]);
  }, [desk, quote.id, quote.orders.length, quote.sourcingContext]);

  useEffect(() => {
    if (quoteStep && canSaveSale) {
      const next = saleDraftFromQuote(quote);
      saleDraftRef.current = next;
      setEditingSale(true);
      setSaleDraft(next);
      setSaleError(undefined);
      return;
    }
    if (!canSaveSale || pureLogistics) {
      saleDraftRef.current = null;
      setEditingSale(false);
      setSaleDraft(null);
      return;
    }
    setEditingSale(true);
    setSaleDraft(saleDraftFromQuote(quote));
    setSaleError(undefined);
    // Chỉ khởi tạo lại khi đổi báo giá / quyền sửa — tránh mất nội dung đang gõ khi parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: quote.id + canSaveSale
  }, [quote.id, canSaveSale, pureLogistics, quoteStep]);

  const resetSaleEdit = () => {
    setSaleDraft(saleDraftFromQuote(lead));
    setSaleError(undefined);
  };

  const saveSaleEdit = async () => {
    const current = (quoteStep ? saleDraftRef.current : null) ?? saleDraft;
    if (!current || !onSaveSale) return true;
    const parsed = updatePotentialSchema.safeParse({
      ...current,
      customerKind: current.customerKind || undefined,
      customerType: current.customerType || undefined,
      brand: current.brand || undefined,
      careChannel: current.careChannel || undefined,
      classification: current.classification || undefined,
      packSpec: current.packSpec || undefined,
      packageDimensions: current.packageDimensions,
      weightKg: current.weightKg,
      logisticsClass: current.logisticsClass || undefined,
      shippingMode: current.shippingMode || undefined,
      shipFromAddress: current.shipFromAddress || undefined,
      shipToAddress: current.shipToAddress || undefined,
      requirements: current.requirements || undefined,
      requirementImages: current.requirementImages,
    });
    if (!parsed.success) {
      setSaleError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return false;
    }
    setSalePending(true);
    setSaleError(undefined);
    try {
      const patch = await onSaveSale(parsed.data);
      if (!patch) {
        setSaleError("Không lưu được thông tin khách tiềm năng");
        return false;
      }
      setLead((row) => ({ ...row, ...patch }));
      const saved = saleDraftFromQuote({ ...lead, ...patch });
      saleDraftRef.current = saved;
      setSaleDraft(saved);
      return true;
    } finally {
      setSalePending(false);
    }
  };

  const addSaleImages = async (files: FileList | File[] | null) => {
    if (!saleDraft || !files?.length) return;
    const room = Math.max(0, 20 - saleDraft.requirementImages.length);
    if (room === 0) {
      setSaleError("Tối đa 20 ảnh yêu cầu");
      return;
    }
    setSalePending(true);
    setSaleError(undefined);
    try {
      const uploaded = await uploadImageFiles([...files].slice(0, room));
      setSaleDraft({ ...saleDraft, requirementImages: [...saleDraft.requirementImages, ...uploaded] });
    } catch (err: unknown) {
      setSaleError(err instanceof Error ? err.message : "Không tải được ảnh");
    } finally {
      setSalePending(false);
    }
  };

  const payloadFor = (nextOrders: QuoteOrder[]): UpdateQuoteInput | null => {
    const parsed = updateQuoteSchema.safeParse({
      templateId: templateId || null,
      opsNote,
      quoteStatus,
      contractStatus,
      orders: nextOrders,
      notes: notesWithFreight(notesRef.current, nextOrders, lead.shippingMode),
      bank,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return null;
    }
    const paymentOrder = orderForQuotePdf(nextOrders);
    const paymentError = paymentOrder && buildQuoteSheet(quoteSheetInputOf({ ...lead, notes: parsed.data.notes, bank }, paymentOrder)).payment?.error;
    if (paymentError) { setFormError(paymentError); return null; }
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
    void (async () => {
      if (quoteStep && !(await saveSaleEdit())) return;
      await persist(orders, true);
    })();
  };

  const openContract = async () => {
    if (pending) return;
    if (mode !== "none" && !(await persist(orders, false))) return;
    setContractOpen(true);
  };

  const transferLogistics = async (nextOrders: QuoteOrder[] = orders) => {
    if (nextOrders.length === 0) {
      setFormError("Nhập thông tin đơn hàng trước khi chuyển logistics");
      return;
    }
    if (quoteStep && !(await saveSaleEdit())) return;
    const ok = await persist(nextOrders, false);
    if (!ok || !onHandoffLogistics) return;
    const handed = await onHandoffLogistics();
    if (handed) onClose();
  };

  const transferSourcing = async (nextOrders: QuoteOrder[] = orders) => {
    const ready = nextOrders.some((order) => order.lines.some((line) => line.productName?.trim() && line.quantity != null && line.quantity > 0));
    if (!ready) {
      setFormError("Nhập mặt hàng và số lượng trước khi chuyển Sourcing");
      return;
    }
    if (quoteStep && !(await saveSaleEdit())) return;
    const ok = await persist(nextOrders, false);
    if (!ok || !onHandoffSourcing) return;
    const handed = await onHandoffSourcing();
    if (handed) onClose();
  };

  const [printLang, setPrintLangState] = useState<QuoteLang>(() => (typeof window === "undefined" ? "vi" : readPrintLang()));
  const setPrintLang = (lang: QuoteLang) => {
    setPrintLangState(lang);
    try { window.localStorage.setItem(PRINT_LANG_KEY, lang); } catch { /* bỏ qua khi trình duyệt chặn lưu */ }
  };

  const issuedOn = useMemo(() => (quote.createdAt ? ISSUED_DATE_FORMAT.format(new Date(quote.createdAt)) : undefined), [quote.createdAt]);

  const sheetInputFor = (order: QuoteOrder, lang: QuoteLang = printLang) =>
    quoteSheetInputOf(quoteWithLogisticsCosts(
      { ...lead, code: quote.code, notes: notesWithFreight(notes, [order], lead.shippingMode), bank },
      desk === "sourcing" ? quote.logisticsSheet?.sentQuote : null,
    ), order, lang, issuedOn);

  const sheetHtmlFor = (order: QuoteOrder, lang: QuoteLang = printLang) => quoteSheetHtml(sheetInputFor(order, lang));

  const selectedOrder = orderForQuotePdf(orders);

  /** Các ô chữ đã có tiếng Việt nhưng chưa có tiếng Anh: để trống khi in bản tiếng Anh. */
  const missingFor = (order: QuoteOrder | undefined, lang: QuoteLang): string[] =>
    lang === "en" && order ? buildQuoteSheet(sheetInputFor(order, lang)).missing : [];
  // Chỉ dựng lại mô hình khi nội dung báo giá đổi, không dựng lại ở mỗi lần gõ phím ở ô khác.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const enMissing = useMemo(() => (printLang === "en" ? missingFor(selectedOrder, "en") : []), [printLang, selectedOrder, lead, notes, bank, issuedOn, quote.code]);
  /** Xem trước đơn hàng chỉ dựng khi đang mở chế độ xem. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previewHtml = useMemo(() => (draft?.mode === "view" ? sheetHtmlFor(draft.order) : ""), [draft, printLang, lead, notes, bank, issuedOn, quote.code]);

  /** In, PDF, Excel đều mở hộp thoại chọn ngôn ngữ trước khi chạy. */
  const [outputPick, setOutputPick] = useState<{ action: QuoteOutputAction; order?: QuoteOrder } | null>(null);

  const printOrder = (order: QuoteOrder, lang: QuoteLang) => {
    void printQuoteSheet(sheetHtmlFor(order, lang));
  };

  /** Chạy một lần tải về, bật cờ đang tải và báo lỗi bằng `failure` nếu thất bại. */
  const runDownload = async (failure: string, task: () => Promise<void>) => {
    setPdfPending(true);
    setFormError(undefined);
    try {
      await task();
    } catch {
      setFormError(failure);
    } finally {
      setPdfPending(false);
    }
  };

  const downloadOrderExcel = (order: QuoteOrder, lang: QuoteLang) =>
    runDownload(quoteOutputText.excel.failed, () => downloadQuoteExcel(sheetInputFor(order, lang), quoteFileBase(quote.code, order.name, lang)));

  const downloadOrderPdf = (order: QuoteOrder, lang: QuoteLang) =>
    runDownload(quoteOutputText.pdf.failed, () => downloadQuotePdf(sheetHtmlFor(order, lang), quoteFileBase(quote.code, order.name, lang)));

  const printSelected = (lang: QuoteLang) => {
    const selected = orders.filter((order) => order.selected);
    const targets = selected.length > 0 ? selected : orders;
    if (targets.length === 0) {
      setFormError(quoteOutputText.print.noSheet);
      return;
    }
    setFormError(undefined);
    void printQuoteSheet(targets.map((order) => sheetHtmlFor(order, lang)));
  };

  /** Mở hộp thoại chọn ngôn ngữ cho nút In / Tải PDF / Tải Excel ở thanh công cụ. */
  const askOutput = (action: QuoteOutputAction) => {
    if (!selectedOrder) {
      setFormError(quoteOutputText[action].noSheet);
      return;
    }
    setFormError(undefined);
    setOutputPick({ action });
  };

  const confirmOutput = (lang: QuoteLang) => {
    const pick = outputPick;
    setOutputPick(null);
    if (!pick) return;
    const target = pick.order ?? selectedOrder;
    if (notes.payment && !payloadFor(target ? [target] : orders)) return;
    if (pick.action === "print") {
      if (pick.order) printOrder(pick.order, lang);
      else printSelected(lang);
      return;
    }
    if (!target) return;
    if (pick.action === "pdf") void downloadOrderPdf(target, lang);
    else void downloadOrderExcel(target, lang);
  };

  const openCreate = () => {
    setDraft({
      mode: "create",
      order: {
        id: crypto.randomUUID(),
        name: "",
        selected: orders.every((order) => !order.selected),
        currency: notes.payment?.quoteCurrency ?? (isFcl ? "USD" : "VND"),
        rate: null,
        priceColumns: [],
        lines: [emptyLine("1")],
      },
    });
  };

  const persistDraft = async (order: QuoteOrder) => {
    const exists = orders.some((item) => item.id === order.id);
    const next = exists ? orders.map((item) => (item.id === order.id ? order : item)) : [...orders, order];
    return persist(next, false);
  };

  const toggle = (id: string, checked: boolean) => {
    if (!canEditOrderPrices) return;
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


  const priceColumns = listPriceColumns(orders);
  const showSourcingLineColumns = desk === "sourcing" && !sourcingSale;

  const actions = (
    <>
      {!quoteStep && <NativeSelect className="h-9 w-36" aria-label="Ngôn ngữ nhập nội dung" title="Ngôn ngữ đang nhập nội dung chữ (quy cách, ghi chú...)" value={printLang} onChange={(event) => setPrintLang(event.target.value as QuoteLang)}>
        {quoteLangs.map((lang) => <option key={lang} value={lang}>{`Nhập: ${quoteLangLabels[lang]}`}</option>)}
      </NativeSelect>}
      {!quoteStep && <Button type="button" variant="outline" onClick={() => askOutput("print")}><Printer />In</Button>}
      {!quoteStep && <Button type="button" variant="outline" disabled={pdfPending} onClick={() => askOutput("pdf")}>
        <Download />{pdfPending ? "Đang tải…" : "Tải PDF"}
      </Button>}
      {!quoteStep && <Button type="button" variant="outline" disabled={pdfPending} onClick={() => askOutput("excel")}>
        <Download />Tải Excel
      </Button>}
      {canSendQuote && onSend && <Button type="button" disabled={pending} onClick={() => setConfirmSend(true)}><Send />Gửi báo giá</Button>}
      {canSendQuote && sent && desk === "sourcing" && isCombinedSourcing(quote) && onContinueLogistics && <Button type="button" disabled={pending} onClick={() => setLogisticsHandoff(true)}>Gửi qua Logistics</Button>}
      {!canSendQuote && onReturn && sent && <Button type="button" disabled={pending} onClick={() => setConfirmReturn(true)}><RotateCcw />Gửi lại báo giá</Button>}
      {allowContract && !embedded && lane && contractStatus !== "DA_TAO" && (
        <Button type="button" variant="outline" disabled={pending} onClick={() => void openContract()}>Chuyển Hợp đồng</Button>
      )}
      {!embedded && <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>}
      {(canEditContent || canEditLogisticsFees) && <Button type="button" disabled={pending} onClick={save}>{pending ? "Đang lưu…" : "Lưu"}</Button>}
    </>
  );

  const tabTriggerClass =
    "h-12 min-h-12 w-full min-w-0 items-center justify-center rounded-xl px-2 py-2 text-base font-bold tracking-wide text-foreground shadow-none after:hidden hover:bg-background/70 hover:text-foreground data-active:bg-primary data-active:text-primary-foreground data-active:shadow-md data-active:hover:bg-primary data-active:hover:text-primary-foreground sm:h-14 sm:min-h-14 sm:px-4 sm:py-3 sm:text-lg";
  const tabPanelClass = embedded
    ? "mt-3 space-y-4"
    : "mt-3 min-h-0 space-y-4 overflow-y-auto pr-1";
  const defaultTab = pureLogistics ? (canPriceAsLogistics ? "logistics" : "sale") : saleFill ? "sale" : desk === "sourcing" ? "sourcing" : desk === "logistics" ? "logistics" : "sale";
  const [tab, setTab] = useState(defaultTab);
  useEffect(() => { setTab(defaultTab); }, [quote.id, defaultTab]);
  const logisticsLeadFacts: [string, string][] = [
    ["Quy cách đóng gói (tiềm năng)", lead.packSpec || "—"],
    ["Kích thước kiện hàng", lead.packageDimensions || "—"],
    ["Trọng lượng", lead.weightKg || "—"],
    ["Phân loại logistics", lead.logisticsClass || "—"],
    ["Phương thức vận chuyển", lead.shippingMode === "AIR" ? "Đường bay" : lead.shippingMode === "SEA" ? "Đường biển" : "—"],
    ["Địa chỉ gửi", lead.shipFromAddress || "—"],
    ["Địa chỉ nhận", lead.shipToAddress || "—"],
  ];
  const requirementImages = lead.requirementImages ?? [];
  const saleFact = (value: string | null | undefined) => (value && value.trim() ? value : "—");
  const saleContactFacts: [string, string, boolean?][] = [
    ["Tên khách", saleFact(lead.customerName)],
    ["Công ty", saleFact(lead.companyName)],
    ["Số điện thoại", saleFact(lead.phone)],
    ["Email", saleFact(lead.email)],
    ["Địa chỉ", saleFact(lead.address), true],
  ];
  const saleNeedFacts: [string, string, boolean?][] = [
    ["Hàng hóa", saleFact(lead.goods), true],
    ["Số lượng", saleFact(lead.quantityNote)],
    ["Yêu cầu của khách", saleFact(lead.requirements), true],
    ["Ghi chú sale", saleFact(lead.saleNote), true],
  ];

  const patchOrderLinePackages = (orderId: string, lineIndex: number, packages: QuoteLine["packages"]) => {
    setOrders((current) => current.map((order) => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        lines: order.lines.map((line, index) => {
          if (index !== lineIndex) return line;
          let next: QuoteLine = { ...line, packages };
          if (packages.length > 0) {
            const m = packageMetrics(packages, lead.shippingMode);
            const quantity = next.quantity && next.quantity > 0 ? next.quantity : 1;
            next = { ...next, cbm: m.cbm / quantity, weightKg: m.chargeableKg / quantity };
          }
          return recalcLine(next);        }),
      };
    }));
  };


  const patchOrderLine = (orderId: string, lineIndex: number, patch: Partial<QuoteLine>) => {
    setOrders((current) => current.map((order) => (order.id !== orderId ? order : {
      ...order,
      lines: order.lines.map((row, index) => (index === lineIndex ? recalcLine({ ...row, ...patch }) : row)),
    })));
  };

  const sheet = (
    <>
      {(formError || error) && <InlineAlert>{formError || error}</InlineAlert>}
      {printLang === "en" && (
        <InlineAlert tone={enMissing.length > 0 ? "warning" : "info"}>
          {enMissing.length > 0
            ? `Đang sửa bản tiếng Anh. Còn ${enMissing.length} ô chưa có tiếng Anh, sẽ để trống khi in: ${enMissing.slice(0, 8).join("; ")}${enMissing.length > 8 ? "…" : ""}`
            : "Đang sửa bản tiếng Anh. Các ô chữ không tự dịch, hãy điền tiếng Anh cho từng ô."}
        </InlineAlert>
      )}
      {needsNewQuote && canEditPricing && <InlineAlert>Sale đã gửi lại báo giá. Hãy tạo mẫu mới rồi bấm Gửi báo giá.</InlineAlert>}
      {mode === "content" && !saleFill && quote.customerKind !== "LOGISTICS" && (
        <InlineAlert>
          Sale điền ảnh, số lượng ở Sourcing. Sourcing nhập thông tin đơn hàng và đóng gói; Logistics chỉ nhập chi phí logistics. Mua hàng bổ sung thuộc tính chi tiết từ xưởng; vận hành điền đơn giá để báo giá.
        </InlineAlert>
      )}
      {onHandoffLogistics && !pureLogistics && (
        <InlineAlert>
          Sale nhập thông tin đơn hàng (ảnh, số lượng, quy cách, đóng gói) ở phần Sale. Logistics nhập chi phí logistics. Nút chuyển logistics nằm ở phần thông tin đơn hàng của Sale.
        </InlineAlert>
      )}
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className={embedded ? "grid gap-0" : "min-h-0 flex-1 overflow-hidden"}>
        {!quoteStep && <TabsList className={`grid h-auto w-full shrink-0 grid-cols-2 items-stretch gap-1 rounded-2xl border border-foreground/10 bg-muted p-1.5 group-data-horizontal/tabs:h-auto sm:gap-2 sm:p-2 ${pureLogistics || desk === "logistics" || saleFill ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {([
            ["sale", "Sale"],
            ["sourcing", "Sourcing"],
            ["logistics", "Logistics"],
          ] as const).filter(([value]) => {
            if (pureLogistics) return value === "sale" || value === "logistics";
            if (saleFill) return value === "sale";
            return desk !== "logistics" || value !== "sourcing";
          }).map(([value, label]) => (
            <TabsTrigger key={value} value={value} className={tabTriggerClass}>
              {saleLogisticsOrder && value === "sourcing" ? "Thông tin đơn hàng" : label}
            </TabsTrigger>
          ))}
        </TabsList>}

        {(!pureLogistics || tab === "sale") && <div className={pureLogistics ? tabPanelClass : "contents"}>
        {!quoteStep && <TabsContent value="sale" className={pureLogistics ? "space-y-4" : tabPanelClass}>
          {(opsNote.trim() || notes.opsExtra.trim()) && (
            <section className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <h3 className="font-semibold text-amber-950">Ghi chú vận hành</h3>
              {opsNote.trim() && <p className="whitespace-pre-wrap">{opsNote}</p>}
              {notes.opsExtra.trim() && <p className="whitespace-pre-wrap">{notes.opsExtra}</p>}
            </section>
          )}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3">
              <span className="rounded-md bg-background px-2.5 py-1 font-mono text-base font-semibold tracking-wide">{lead.leadCode || "—"}</span>
              {lead.messCode ? (
                <span className="rounded-md border bg-background px-2.5 py-1 font-mono text-base text-muted-foreground">{lead.messCode}</span>
              ) : null}
              <span className="rounded-md bg-primary/10 px-2.5 py-1 text-base font-medium text-primary">
                {labelOf(potentialOptions, lead.potential)}
              </span>
              {lead.linkMess && /^https?:\/\//i.test(lead.linkMess) ? (
                <a href={lead.linkMess} target="_blank" rel="noreferrer" className="text-base font-medium text-primary hover:underline">
                  Mở link mess
                </a>
              ) : null}
              {editingSale && saleDraft ? (
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={salePending} onClick={resetSaleEdit}>Hoàn tác</Button>
                  <Button type="button" size="sm" disabled={salePending} onClick={() => void saveSaleEdit()}>
                    {salePending ? "Đang lưu…" : "Lưu thông tin"}
                  </Button>
                </div>
              ) : canSaveSale && (pureLogistics || saleFill) ? (
                <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => { setSaleError(undefined); setSaleDraft(saleDraftFromQuote(lead)); setEditingSale(true); }}>
                  Sửa thông tin khách
                </Button>
              ) : null}
            </div>

            {saleError ? <InlineAlert>{saleError}</InlineAlert> : null}

            {editingSale && saleDraft ? (
              <div className="space-y-3 text-base [&_label]:text-base [&_input]:h-11 [&_input]:text-base [&_textarea]:text-base [&_select]:h-11 [&_select]:text-base">
                <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">Liên hệ</h3>
                  <Field label="Tên khách" htmlFor={fieldId("sale-name")} required>
                    <Input id={fieldId("sale-name")} value={saleDraft.fullName} onChange={(event) => setSaleDraft({ ...saleDraft, fullName: event.target.value })} />
                  </Field>
                  <Field label="Công ty" htmlFor={fieldId("sale-company")}>
                    <Input id={fieldId("sale-company")} value={saleDraft.companyName} onChange={(event) => setSaleDraft({ ...saleDraft, companyName: event.target.value })} />
                  </Field>
                  <Field label="Số điện thoại" htmlFor={fieldId("sale-phone")}>
                    <Input id={fieldId("sale-phone")} value={saleDraft.phone} onChange={(event) => setSaleDraft({ ...saleDraft, phone: event.target.value })} />
                  </Field>
                  <Field label="Email" htmlFor={fieldId("sale-email")}>
                    <Input id={fieldId("sale-email")} value={saleDraft.email} onChange={(event) => setSaleDraft({ ...saleDraft, email: event.target.value })} />
                  </Field>
                  <Field label="Địa chỉ" htmlFor={fieldId("sale-address")} className="sm:col-span-2">
                    <Input id={fieldId("sale-address")} value={saleDraft.address} onChange={(event) => setSaleDraft({ ...saleDraft, address: event.target.value })} />
                  </Field>
                </section>

                <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">Phân loại khách</h3>
                  <Field label="Nguồn" htmlFor={fieldId("sale-brand")}>
                    <NativeSelect id={fieldId("sale-brand")} value={saleDraft.brand} onChange={(event) => setSaleDraft({ ...saleDraft, brand: event.target.value as SaleLeadDraft["brand"] })}>
                      <option value="">Chưa chọn</option>
                      {brandOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Giai đoạn" htmlFor={fieldId("sale-stage")} required>
                    <NativeSelect id={fieldId("sale-stage")} value={saleDraft.potential} onChange={(event) => setSaleDraft({ ...saleDraft, potential: event.target.value as SaleLeadDraft["potential"] })}>
                      {potentialOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Loại khách" htmlFor={fieldId("sale-kind")}>
                    <NativeSelect id={fieldId("sale-kind")} value={saleDraft.customerKind} onChange={(event) => setSaleDraft({ ...saleDraft, customerKind: event.target.value as SaleLeadDraft["customerKind"] })}>
                      <option value="">Chưa chọn</option>
                      {customerKindOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Đối tượng" htmlFor={fieldId("sale-type")}>
                    <NativeSelect id={fieldId("sale-type")} value={saleDraft.customerType} onChange={(event) => setSaleDraft({ ...saleDraft, customerType: event.target.value as SaleLeadDraft["customerType"] })}>
                      <option value="">Chưa chọn</option>
                      {customerTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Kênh chăm sóc" htmlFor={fieldId("sale-care")}>
                    <NativeSelect id={fieldId("sale-care")} value={saleDraft.careChannel} onChange={(event) => setSaleDraft({ ...saleDraft, careChannel: event.target.value as SaleLeadDraft["careChannel"] })}>
                      <option value="">Chưa chọn</option>
                      {careChannelOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Phân loại" htmlFor={fieldId("sale-class")}>
                    <NativeSelect id={fieldId("sale-class")} value={saleDraft.classification} onChange={(event) => setSaleDraft({ ...saleDraft, classification: event.target.value as SaleLeadDraft["classification"] })}>
                      <option value="">Chưa chọn</option>
                      {classificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </Field>
                </section>

                <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
                  <section className="grid gap-3 rounded-lg border p-4">
                    <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Nhu cầu</h3>
                    <Field label="Hàng hóa" htmlFor={fieldId("sale-goods")}>
                      <Input id={fieldId("sale-goods")} value={saleDraft.productInterest} onChange={(event) => setSaleDraft({ ...saleDraft, productInterest: event.target.value })} />
                    </Field>
                    <Field label="Số lượng" htmlFor={fieldId("sale-qty")}>
                      <Input id={fieldId("sale-qty")} value={saleDraft.quantityNote} onChange={(event) => setSaleDraft({ ...saleDraft, quantityNote: event.target.value })} />
                    </Field>
                    <Field label="Yêu cầu của khách" htmlFor={fieldId("sale-requirements")}>
                      <Textarea id={fieldId("sale-requirements")} rows={4} value={saleDraft.requirements} onChange={(event) => setSaleDraft({ ...saleDraft, requirements: event.target.value })} />
                    </Field>
                    <Field label="Ghi chú sale" htmlFor={fieldId("sale-note")}>
                      <Textarea id={fieldId("sale-note")} rows={2} value={saleDraft.saleNote} onChange={(event) => setSaleDraft({ ...saleDraft, saleNote: event.target.value })} />
                    </Field>
                  </section>
                  <section className="grid gap-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Ảnh yêu cầu</h3>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-muted">
                        <ImagePlus className="size-3.5" aria-hidden />
                        Thêm ảnh
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          disabled={salePending || saleDraft.requirementImages.length >= 20}
                          onChange={(event) => {
                            void addSaleImages(event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {saleDraft.requirementImages.length > 0 ? (
                      <div className="space-y-3">
                        <RequirementImageSlider images={saleDraft.requirementImages} showTitle={false} />
                        <div className="flex flex-wrap gap-2">
                          {saleDraft.requirementImages.map((image, index) => (
                            <div key={`${image.slice(0, 48)}-${index}`} className="relative size-16 overflow-hidden rounded-md border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={image} alt={`Ảnh ${index + 1}`} className="size-full object-cover" />
                              <button
                                type="button"
                                className="absolute top-0.5 right-0.5 rounded bg-black/70 p-0.5 text-white"
                                aria-label={`Xóa ảnh ${index + 1}`}
                                onClick={() => setSaleDraft({
                                  ...saleDraft,
                                  requirementImages: saleDraft.requirementImages.filter((_, itemIndex) => itemIndex !== index),
                                })}
                              >
                                <Trash2 className="size-3" aria-hidden />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-8 text-center text-sm text-muted-foreground">
                        Chưa có ảnh yêu cầu. Bấm Thêm ảnh để tải lên.
                      </p>
                    )}
                  </section>
                </div>

                <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2">Logistics (từ tiềm năng)</h3>
                  <Field label="Quy cách đóng gói đã lưu (Sourcing nhập tại đơn hàng)" htmlFor={fieldId("sale-pack")} className="sm:col-span-2">
                    <Textarea id={fieldId("sale-pack")} rows={2} value={saleDraft.packSpec} readOnly />
                  </Field>
                  <Field label="Kích thước kiện hàng" htmlFor={fieldId("sale-dimensions")}>
                    <Input id={fieldId("sale-dimensions")} value={saleDraft.packageDimensions} onChange={(event) => setSaleDraft({ ...saleDraft, packageDimensions: event.target.value })} />
                  </Field>
                  <Field label="Trọng lượng" htmlFor={fieldId("sale-weight")}>
                    <Input id={fieldId("sale-weight")} value={saleDraft.weightKg} onChange={(event) => setSaleDraft({ ...saleDraft, weightKg: event.target.value })} />
                  </Field>
                  <Field label="Phương thức vận chuyển" htmlFor={fieldId("sale-shipping-mode")}>
                    <NativeSelect id={fieldId("sale-shipping-mode")} value={saleDraft.shippingMode} onChange={(event) => setSaleDraft({ ...saleDraft, shippingMode: event.target.value as SaleLeadDraft["shippingMode"], logisticsClass: "", classification: "" })}>
                      <option value="">Chưa chọn</option><option value="AIR">Đường bay</option><option value="SEA">Đường biển</option>
                    </NativeSelect>
                  </Field>
                  {saleDraft.shippingMode === "SEA" && <Field label="Phân loại logistics" htmlFor={fieldId("sale-logistics")}>
                    <NativeSelect id={fieldId("sale-logistics")} value={saleDraft.logisticsClass} onChange={(event) => setSaleDraft({ ...saleDraft, logisticsClass: event.target.value as SaleLeadDraft["logisticsClass"], classification: event.target.value as SaleLeadDraft["classification"] })}>
                      <option value="">Chưa chọn</option>
                      {classificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </Field>}
                  <Field label="Địa chỉ gửi" htmlFor={fieldId("sale-from")}>
                    <Textarea id={fieldId("sale-from")} rows={2} value={saleDraft.shipFromAddress} onChange={(event) => setSaleDraft({ ...saleDraft, shipFromAddress: event.target.value })} />
                  </Field>
                  <Field label="Địa chỉ nhận" htmlFor={fieldId("sale-to")}>
                    <Textarea id={fieldId("sale-to")} rows={2} value={saleDraft.shipToAddress} onChange={(event) => setSaleDraft({ ...saleDraft, shipToAddress: event.target.value })} />
                  </Field>
                </section>
              </div>
            ) : (
              <>
                <SaleFactsTable groups={[{ title: "Liên hệ", rows: saleContactFacts }]} />

                <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
                  <SaleFactsTable groups={[{ title: "Nhu cầu", rows: saleNeedFacts }]} />
                  <div className="overflow-hidden rounded-lg border">
                    <div className="border-b bg-muted/50 px-4 py-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Ảnh yêu cầu</div>
                    <div className="p-3">
                      {requirementImages.length > 0 ? (
                        <RequirementImageSlider images={requirementImages} showTitle={false} />
                      ) : (
                        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-8 text-center text-sm text-muted-foreground">
                          Chưa có ảnh yêu cầu từ khách tiềm năng.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>}

        <TabsContent value={pureLogistics || saleFill ? "sale" : "sourcing"} className={pureLogistics || saleFill ? "min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" : tabPanelClass}>
          {quoteStep && saleDraft && (
            <>
              {/* Nhu cầu Tìm hàng: Sale chỉ nhập mặt hàng/ảnh/số lượng/lưu ý từng dòng, không hiện Yêu cầu của khách + Ghi chú sale. */}
              {!sourcingSale && <QuoteStepNotes key={quote.id} initial={saleDraft} draftRef={saleDraftRef} fieldId={fieldId} />}
              {saleError ? <InlineAlert>{saleError}</InlineAlert> : null}
            </>
          )}
          {!pureLogistics && !saleFill && <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-base sm:grid-cols-2">
            <p><span className="text-muted-foreground">Khách hàng: </span>{quote.customerName || "—"}</p>
            <p><span className="text-muted-foreground">Công ty: </span>{quote.companyName || "—"}</p>
            <p><span className="text-muted-foreground">Địa chỉ: </span>{quote.address || "—"}</p>
            <p><span className="text-muted-foreground">SĐT: </span>{quote.phone || "—"}</p>
            <p className="sm:col-span-2"><span className="text-muted-foreground">Email: </span>{quote.email || "—"}</p>
          </div>}

          {isFcl && <FclQuoteForm
            currency={notes.payment?.quoteCurrency ?? "USD"}
            value={notes.fcl ?? emptyFclQuote(lead.companyName || lead.customerName || "", lead.goods || "", lead.weightKg || "")}
            onChange={(fcl) => commitNotes({ ...notesRef.current, fcl })}
            shipmentEditable={canEditContent}
            chargesEditable={false}
          />}
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-medium">Thông tin đơn hàng</h3>
              <div className="flex flex-wrap gap-2">
                {onHandoffSourcing && (
                  <Button type="button" variant="outline" disabled={pending} onClick={() => { void transferSourcing(); }}>Chuyển Sourcing</Button>
                )}
                {onHandoffLogistics && (
                  <Button type="button" variant="outline" disabled={pending} onClick={() => { void transferLogistics(); }}>Chuyển logistics</Button>
                )}
                {canEditContent && <Button type="button" variant="outline" disabled={pending} onClick={openCreate}><Plus />Tạo thông tin đơn hàng</Button>}
              </div>
            </div>
            <TableHScroll className="rounded-lg">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="whitespace-nowrap px-3 py-3 font-medium">Chọn</th>
                    <th className="whitespace-nowrap px-3 py-3 font-medium">Hình ảnh</th>
                    <th className="whitespace-nowrap px-3 py-3 font-medium">Tên mẫu</th>
                    {showSourcingLineColumns && <th className="whitespace-nowrap px-3 py-3 font-medium">Mặt hàng</th>}
                    <th className="whitespace-nowrap px-3 py-3 font-medium">Số lượng</th>
                    {showSourcingLineColumns && <th className="whitespace-nowrap px-3 py-3 font-medium">Kg/CBM</th>}
                    {!sourcingSale && <th className="whitespace-nowrap px-3 py-3 font-medium">Tỷ giá</th>}
                    {!sourcingSale && priceColumns.map((column) => (
                      <th key={`price-${column.currency}`} className="whitespace-nowrap px-3 py-3 font-medium">Đơn giá ({column.currency})</th>
                    ))}
                    {!sourcingSale && priceColumns.map((column) => (
                      <th key={`total-${column.currency}`} className="whitespace-nowrap px-3 py-3 text-right font-medium">Thành tiền ({column.currency})</th>
                    ))}
                    {!sourcingSale && <>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Số kiện</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-medium">CBM</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Cân nặng (kg)</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Cân tính cước (kg)</th>
                    <th className="whitespace-nowrap px-3 py-3 font-medium">Ghi chú</th>
                    </>}
                    {sourcingSale && <th className="whitespace-nowrap px-3 py-3 font-medium">Lưu ý</th>}
                    <th className="whitespace-nowrap px-3 py-3 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr><td colSpan={sourcingSale ? 6 : 11 + priceColumns.length * 2 + (showSourcingLineColumns ? 2 : 0)} className="px-3 py-6 text-center text-muted-foreground">Chưa có thông tin đơn hàng.</td></tr>
                  )}
                  {orders.map((order) => {
                    const totals = quoteTotals(order.lines);
                    const previewImages = order.lines
                      .flatMap((line) => quoteLineImages(line).map(safeImage).filter(Boolean))
                      .slice(0, 6);
                    const quantityText = orderQuantityText(order.lines);
                    const specText = orderSpecText(order.lines);
                    const noteText = orderNoteText(order.lines);
                    const packed = packageMetrics(order.lines.flatMap((line) => line.packages), lead.shippingMode);
                    return (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={order.selected}
                            disabled={!canEditOrderPrices || pending}
                            aria-label={`Chọn ${order.name}`}
                            onChange={(event) => toggle(order.id, event.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {previewImages.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {previewImages.map((src, imageIndex) => (
                                <img
                                  key={`${order.id}-${imageIndex}`}
                                  src={src}
                                  alt=""
                                  className="h-14 w-14 rounded border bg-white object-contain"
                                />
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="max-w-xs px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{order.name}</span>
                            {order.selected && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Đang chọn</span>}
                          </div>
                          {specText && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground" title={specText}>{specText}</p>}
                          {order.lines.map((line, lineIndex) => {
                            const packedText = packagesText(line.packages, "vi", lead.shippingMode);
                            if (!packedText) return null;
                            return (
                              <p key={`${order.id}-pack-${lineIndex}`} className="mt-1 whitespace-pre-line text-xs text-muted-foreground" title={packedText}>
                                {`STT ${line.stt || lineIndex + 1} · ${packedText}`}
                              </p>
                            );
                          })}
                        </td>
                        {showSourcingLineColumns && (
                          <td className="min-w-48 px-3 py-2">
                            {order.lines.length === 0 ? "—" : order.lines.map((line, index) => (
                              <div key={index} className="flex h-10 items-center border-b last:border-0" title={line.productName || undefined}>
                                <span className="max-w-64 truncate">{line.productName || "—"}</span>
                              </div>
                            ))}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-3 py-2">
                          {showSourcingLineColumns
                            ? order.lines.length === 0 ? "—" : order.lines.map((line, index) => (
                              <div key={index} className="flex h-10 items-center border-b last:border-0">{line.quantity == null ? "—" : `${money(line.quantity)} ${line.unit?.trim() || "cái"}`}</div>
                            ))
                            : quantityText || "—"}
                        </td>
                        {showSourcingLineColumns && (
                          <td className="whitespace-nowrap px-3 py-2">
                            {order.lines.length === 0 ? "—" : order.lines.map((line, index) => {
                              const unit = line.unit?.trim() || "cái";
                              const metrics = [
                                line.weightKg != null ? `${money(line.weightKg)} kg/${unit}` : null,
                                line.cbm != null ? `${money(line.cbm)} CBM/${unit}` : null,
                                line.basis === "m2" && line.areaM2 != null ? `${money(line.areaM2)} m2/${unit}` : null,
                              ].filter(Boolean);
                              return <div key={index} className="flex h-10 items-center border-b last:border-0">{metrics.length ? metrics.join(" · ") : "—"}</div>;
                            })}
                          </td>
                        )}
                        {!sourcingSale && <td className="whitespace-nowrap px-3 py-2 font-medium">{columnsFor(order).map((column) => column.currency).join(" · ")}</td>}
                        {!sourcingSale && priceColumns.map((column) => {
                          const amounts = columnAmounts(order, column.currency);
                          return (
                            <td key={`price-${column.currency}`} className="whitespace-nowrap px-3 py-2">
                              {showSourcingLineColumns ? order.lines.length === 0 ? "—" : order.lines.map((line, index) => {
                                const amount = lineCurrencyPrice(line, order.currency, column.currency);
                                return <div key={index} className="flex h-10 items-center border-b last:border-0">{amount.price == null ? "—" : `${money(amount.price)} ${column.currency}/${priceUnit(line)}`}</div>;
                              }) : amounts.texts.length === 0 ? <span className="text-muted-foreground">—</span> : (
                                <div className="grid gap-0.5">
                                  {amounts.texts.slice(0, 2).map((item, index) => <span key={index}>{item}</span>)}
                                  {amounts.texts.length > 2 && <span className="text-xs text-muted-foreground">+{amounts.texts.length - 2} dòng khác</span>}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        {!sourcingSale && priceColumns.map((column) => {
                          const amounts = columnAmounts(order, column.currency);
                          return (
                            <td key={`total-${column.currency}`} className="whitespace-nowrap px-3 py-2 text-right">
                              {showSourcingLineColumns ? (
                                <>
                                  {order.lines.length === 0 ? "—" : order.lines.map((line, index) => {
                                    const amount = lineCurrencyPrice(line, order.currency, column.currency);
                                    return <div key={index} className="flex h-10 items-center justify-end border-b last:border-0">{amount.total == null ? "—" : `${money(amount.total)} ${column.currency}`}</div>;
                                  })}
                                  {amounts.total != null && <div className="pt-1 text-xs font-semibold">Tổng mẫu: {money(amounts.total)} {column.currency}</div>}
                                </>
                              ) : amounts.total == null ? <span className="text-muted-foreground">—</span> : <span className="font-medium">{money(amounts.total)} {column.currency}</span>}
                            </td>
                          );
                        })}
                        {!sourcingSale && <>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{totals.packageCount > 0 ? money(totals.packageCount) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{totals.cbm > 0 ? totals.cbm : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{totals.weighed ? money(totals.weight) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{packed.count > 0 ? money(packed.chargeableKg) : "—"}</td>
                        <td className="min-w-40 max-w-xs px-3 py-2">
                          {noteText ? <p className="line-clamp-3 whitespace-pre-line text-xs" title={noteText}>{noteText}</p> : <span className="text-muted-foreground">—</span>}
                        </td>
                        </>}
                        {sourcingSale && (
                          <td className="min-w-40 max-w-xs px-3 py-2">
                            {noteText ? <p className="line-clamp-3 whitespace-pre-line text-xs" title={noteText}>{noteText}</p> : <span className="text-muted-foreground">—</span>}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft({ mode: "view", order })}><Eye />Xem</Button>
                            {canEditContent && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setDraft({ mode: "edit", order: { ...order, lines: order.lines.map((line) => ({ ...line })) } })}><Pencil />Sửa</Button>}
                            {canEditContent && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setRemoving(order)}><Trash2 />Xóa</Button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableHScroll>
          </div>

          {pureLogistics && showPackaging && !isFcl && (
            <OrderPackagesBlock
              orders={orders}
              shippingMode={lead.shippingMode}
              canEdit={canEditPackaging}
              onChange={patchOrderLinePackages}
              emptyHint="Chưa có thông tin đơn hàng — bấm Tạo thông tin đơn hàng."
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {(pureLogistics || sourcingSale) && (
              <WeightNoteField id={fieldId("sale-weight-note")} className="sm:col-span-2" notes={notes} setNotes={commitNotes} lang={printLang} disabled={!canEditSaleNotes} />
            )}
            <Field label="Tổng giá trị hàng hóa (Sourcing)" htmlFor={fieldId("note-total")}>
              <Input id={fieldId("note-total")} value={moneyText(notes.totalLabel)} disabled={!canEditSaleNotes} onChange={(event) => commitNotes({ ...notesRef.current, totalLabel: formatMoneyInput(event.target.value) })} placeholder="0" />
            </Field>
            {validityField("note-valid")}
            <div className="grid gap-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Thông tin đặt cọc</span>
                {canEditSaleNotes && printLang === "vi" && (
                  <Button type="button" variant="outline" size="sm" disabled={pending || notes.deposit.length >= 20} onClick={() => commitNotes({ ...notesRef.current, deposit: [...notesRef.current.deposit, ""] })}>
                    <Plus />Thêm dòng
                  </Button>
                )}
              </div>
              {notes.deposit.length === 0 && <p className="text-sm text-muted-foreground">Chưa có dòng đặt cọc.</p>}
              {notes.deposit.map((line, index) => (
                <div key={index} className="flex gap-2">
                  <DraftText
                    id={index === 0 ? fieldId("note-deposit") : undefined}
                    aria-label={`Thông tin đặt cọc ${index + 1}`}
                    value={printLang === "en" ? notes.depositEn[index] ?? "" : line}
                    placeholder={printLang === "en" ? line : undefined}
                    disabled={!canEditSaleNotes}
                    onValueChange={(next) => {
                      const current = notesRef.current;
                      commitNotes(printLang === "en"
                        ? { ...current, depositEn: current.deposit.map((_, itemIndex) => itemIndex === index ? next : current.depositEn[itemIndex] ?? "") }
                        : { ...current, deposit: current.deposit.map((item, itemIndex) => itemIndex === index ? next : item) });
                    }}
                  />
                  {canEditSaleNotes && printLang === "vi" && (
                    <Button type="button" variant="ghost" size="icon" aria-label={`Xóa dòng đặt cọc ${index + 1}`} disabled={pending} onClick={() => { const current = notesRef.current; commitNotes({ ...current, deposit: current.deposit.filter((_, itemIndex) => itemIndex !== index), depositEn: current.depositEn.filter((_, itemIndex) => itemIndex !== index) }); }}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {!pureLogistics && !sourcingSale && showPackaging && <OrderPackagesBlock
            orders={orders}
            shippingMode={lead.shippingMode}
            canEdit={canEditPackaging}
            onChange={patchOrderLinePackages}
          />}

          {!pureLogistics && !saleFill && <LogisticsFeesEditor
            notes={notes}
            shippingMode={lead.shippingMode}
            setNotes={setNotes}
            canEdit={canEditLogisticsFees}
            canEditOrderNotes={canEditPricing}
            pending={pending}
            fieldId={(name) => fieldId(`sourcing-${name}`)}
            order={selectedOrder}
            lang={printLang}
          />}
          {!pureLogistics && !quoteStep && <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            <Field label="Mẫu báo giá" htmlFor={fieldId("quote-template")}>
              <NativeSelect id={fieldId("quote-template")} value={templateId} disabled={!canEditPricing} onChange={(event) => setTemplateId(event.target.value)}>
                <option value="">Chưa chọn</option>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Ghi chú VH" htmlFor={fieldId("quote-note")}>
              <Input id={fieldId("quote-note")} value={opsNote} disabled={!canEditPricing} onChange={(event) => setOpsNote(event.target.value)} />
            </Field>
            <Field label="Ghi chú thêm cho Sale" htmlFor={fieldId("ops-extra")} className="sm:col-span-2" hint="Ví dụ tách lô vận chuyển, dời lịch. Sale xem được ghi chú này.">
              <Textarea id={fieldId("ops-extra")} rows={3} value={notes.opsExtra} disabled={!canEditPricing} onChange={(event) => setNotes({ ...notes, opsExtra: event.target.value })} />
            </Field>
            <Field label="Trạng thái báo giá" htmlFor={fieldId("quote-status")}>
              <NativeSelect id={fieldId("quote-status")} value={quoteStatus} disabled={!canEditPricing} onChange={(event) => setQuoteStatus(event.target.value as (typeof quoteStatusOptions)[number][0])}>
                {quoteStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Trạng thái hợp đồng" htmlFor={fieldId("quote-contract")}>
              <NativeSelect id={fieldId("quote-contract")} value={contractStatus} disabled={!canEditPricing} onChange={(event) => setContractStatus(event.target.value as (typeof contractStatusOptions)[number][0])}>
                {contractStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </Field>
          </section>}
        </TabsContent>
        </div>}

        <TabsContent value="logistics" className={tabPanelClass}>
          {!pureLogistics && desk === "logistics" && quote.sourcingContext && (
            <section className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <h3 className="font-semibold">Thông tin Sourcing đã chuyển · {quote.sourcingContext.order.name}</h3>
              {quote.sourcingContext.opsNote && <p className="whitespace-pre-wrap text-sm">{quote.sourcingContext.opsNote}</p>}
              <TableHScroll className="rounded-lg">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50 text-left">
                    {["STT", "Mặt hàng", "Ảnh hàng", "Số lượng", "Kg/CBM", "Quy cách / thuộc tính xưởng", "Ghi chú", "Đơn giá Sourcing"].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}
                  </tr></thead>
                  <tbody>{quote.sourcingContext.order.lines.map((line, index) => (
                    <tr key={index} className="border-b align-top last:border-0">
                      <td className="px-3 py-2">{line.stt}</td>
                      <td className="whitespace-pre-wrap px-3 py-2">{line.productName || "—"}</td>
                      <td className="min-w-36 px-3 py-2">{quoteLineImages(line).length > 0 ? <RequirementImageSlider images={quoteLineImages(line)} showTitle={false} /> : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{amountText(line.quantity)} {line.unit}</td>
                      <td className="whitespace-nowrap px-3 py-2">{line.basis === "kg" ? `${amountText(line.weightKg)} kg/set` : line.basis === "cbm" ? `${amountText(line.cbm)} CBM/set` : "—"}</td>
                      <td className="min-w-48 whitespace-pre-wrap px-3 py-2">{[line.spec, ...line.attrs.map((attr) => attr.key + ": " + attr.value)].filter(Boolean).join("\n") || "—"}</td>
                      <td className="whitespace-pre-wrap px-3 py-2">{line.note || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{line.pricePerSet == null ? "—" : money(line.pricePerSet) + " " + quote.sourcingContext!.order.currency + " / " + pricingBasisLabels[line.basis]}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </TableHScroll>
              <p className="text-xs text-muted-foreground">Thông tin tham chiếu từ bản Sourcing đã gửi. Sourcing cung cấp thông tin hàng và đóng gói. Logistics nhập chi phí logistics bên dưới.</p>
            </section>
          )}
          {!pureLogistics && <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
            <h3 className="font-semibold sm:col-span-2">Thông tin logistics từ tiềm năng</h3>
            {logisticsLeadFacts.map(([label, value]) => (
              <p key={label} className={label.startsWith("Quy cách") || label.startsWith("Địa chỉ") ? "sm:col-span-2" : undefined}>
                <span className="text-muted-foreground">{label}: </span>
                <span className="font-medium whitespace-pre-wrap">{value}</span>
              </p>
            ))}
          </div>}

          {showPackaging && quote.customerKind !== "LOGISTICS" && <OrderPackagesBlock
            orders={orders}
            shippingMode={lead.shippingMode}
            canEdit={canEditPackaging}
            onChange={patchOrderLinePackages}
          />}

          <Field label="Ghi chú thêm cho Sale" htmlFor={fieldId("logistics-ops-extra")} hint="Ví dụ tách lô vận chuyển, dời lịch. Sale xem được ghi chú này.">
            <Textarea id={fieldId("logistics-ops-extra")} rows={3} value={notes.opsExtra} disabled={mode !== "full"} onChange={(event) => setNotes({ ...notes, opsExtra: event.target.value })} />
          </Field>

          {desk === "logistics" && <div className="grid gap-3 sm:grid-cols-2">{validityField("logistics-note-valid")}</div>}

          {isFcl && <FclQuoteForm
            value={notes.fcl ?? emptyFclQuote(lead.companyName || lead.customerName || "", lead.goods || "", lead.weightKg || "")}
            currency={notes.payment?.quoteCurrency ?? "USD"}
            onChange={(fcl) => commitNotes({ ...notesRef.current, fcl })}
            shipmentEditable={canPriceAsLogistics}
            chargesEditable={canEditLogisticsFees}
          />}
          {!isFcl && <LogisticsFeesEditor
            notes={notes}
            shippingMode={lead.shippingMode}
            setNotes={setNotes}
            canEdit={canEditLogisticsFees}
            canEditOrderNotes={pureLogistics ? false : canEditPricing}
            pending={pending}
            fieldId={fieldId}
            order={selectedOrder}
            lang={printLang}
          >
          {mode === "full" && orders.length > 0 && (quote.customerKind !== "LOGISTICS" || canPriceAsLogistics) && (
            <section className="grid gap-3 rounded-xl border p-4">
              <h3 className="font-semibold">Đơn giá trên thông tin đơn hàng có sẵn</h3>
              <p className="text-sm text-muted-foreground">
                {pureLogistics ? "Sale chỉ nhập thông tin đơn hàng; Logistics nhập đơn giá và thành tiền." : "Hàng hóa do Sale/Sourcing cung cấp."} Chọn tỷ giá (loại tiền), áp dụng cho mọi dòng; chọn cách tính giá theo đơn vị, kg, m2, CBM hoặc trọn gói; đơn giá nhập thế nào thì dùng thế đó, không quy đổi.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <PriceColumnPicker orders={orders} disabled={pending} onSelect={(currency) => setOrders((current) => current.map((order) => selectRateColumn(order, currency)))} />
              </div>
              <TableHScroll className="rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Đơn hàng</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">STT</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Cách tính giá</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Số tính giá</th>
                      {priceColumns.map((column) => (
                        <th key={`price-${column.currency}`} className="whitespace-nowrap px-3 py-2 font-medium">Đơn giá ({column.currency})</th>
                      ))}
                      {priceColumns.map((column) => (
                        <th key={`total-${column.currency}`} className="whitespace-nowrap px-3 py-2 text-right font-medium">Thành tiền ({column.currency})</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.flatMap((order) => order.lines.map((line, index) => (
                      <tr key={`${order.id}-${index}`} className="border-b last:border-0">
                        <td className="whitespace-nowrap px-3 py-2">{index === 0 ? order.name || "Đơn hàng" : ""}</td>
                        <td className="whitespace-nowrap px-3 py-2">{line.stt || index + 1}</td>
                        <td className="px-3 py-2">
                          <NativeSelect className="h-8 w-36 text-xs" aria-label={`Cách tính giá dòng ${index + 1}`} value={line.basis} disabled={pending} onChange={(event) => patchOrderLine(order.id, index, { basis: event.target.value as PricingBasis })}>
                            {(Object.keys(pricingBasisLabels) as PricingBasis[]).map((b) => <option key={b} value={b}>{pricingBasisLabels[b]}</option>)}
                          </NativeSelect>
                        </td>
                        <td className="px-3 py-2">
                          {line.basis in basisMetric ? (
                            <BasisMetricInput className="h-8 w-24" line={line} index={index} disabled={pending} onChange={(patch) => patchOrderLine(order.id, index, patch)} />
                          ) : (
                            <span className="text-muted-foreground">{line.basis === "unit" ? (line.quantity ?? "—") : "—"}</span>
                          )}
                        </td>
                        {priceColumns.map((column) => {
                          const amount = lineCurrencyPrice(line, order.currency, column.currency);
                          return (
                            <td key={`price-${column.currency}`} className="px-3 py-2">
                              <MoneyInput
                                className="h-8 w-32"
                                fractionDigits={3}
                                aria-label={`Đơn giá ${column.currency} dòng ${index + 1}`}
                                value={amount.price}
                                onValueChange={(pricePerSet) => setOrders((current) => current.map((item) => item.id === order.id
                                  ? { ...item, lines: item.lines.map((row, lineIndex) => lineIndex === index ? withCurrencyPrice(row, item.currency, column.currency, pricePerSet) : row) }
                                  : item))}
                              />
                            </td>
                          );
                        })}
                        {priceColumns.map((column) => {
                          const amount = lineCurrencyPrice(line, order.currency, column.currency);
                          return (
                            <td key={`total-${column.currency}`} className="px-3 py-2">
                              <MoneyInput
                                className="h-8 w-32"
                                fractionDigits={3}
                                aria-label={`Thành tiền ${column.currency} dòng ${index + 1}`}
                                value={amount.total}
                                disabled={pending}
                                onValueChange={(lineTotal) => {
                                  const formula = lineAmount({ basis: line.basis, quantity: line.quantity, price: amount.price, weightKg: line.weightKg, cbm: line.cbm, areaM2: line.areaM2 });
                                  const manual = lineTotal !== formula;
                                  if (column.currency === order.currency) {
                                    patchOrderLine(order.id, index, { lineTotal: manual ? lineTotal : formula, lineTotalManual: manual });
                                    return;
                                  }
                                  const prices = [...(line.prices ?? []).filter((item) => item.currency !== column.currency), { currency: column.currency, pricePerSet: amount.price, lineTotal: manual ? lineTotal : formula, lineTotalManual: manual }];
                                  patchOrderLine(order.id, index, { prices });
                                }}
                              />
                              {amount.totalManual && (
                                <button type="button" className="text-[11px] text-primary underline" onClick={() => {
                                  if (column.currency === order.currency) patchOrderLine(order.id, index, { lineTotalManual: false });
                                  else {
                                    const formula = lineAmount({ basis: line.basis, quantity: line.quantity, price: amount.price, weightKg: line.weightKg, cbm: line.cbm, areaM2: line.areaM2 });
                                    const prices = [...(line.prices ?? []).filter((item) => item.currency !== column.currency), { currency: column.currency, pricePerSet: amount.price, lineTotal: formula, lineTotalManual: false }];
                                    patchOrderLine(order.id, index, { prices });
                                  }
                                }}>Tính lại</button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )))}
                  </tbody>
                </table>
              </TableHScroll>
            </section>
          )}

          </LogisticsFeesEditor>}
          <QuotePaymentEditor
            payment={notes.payment}
            bank={bank}
            currency={isFcl ? "USD" : resolvedFreightCurrency(notes, selectedOrder?.currency ?? "VND")}
            model={selectedOrder ? buildQuoteSheet(sheetInputFor(selectedOrder)) : null}
            disabled={!canEditLogisticsFees || pending}
            fieldId={fieldId}
            onPayment={(payment) => commitNotes({ ...notesRef.current, payment })}
            onBank={setBank}
            onCurrency={(currency) => {
              const current = notesRef.current;
              if (!current.payment) return;
              setOrders((items) => items.map((order) => selectRateColumn(order, currency)));
              commitNotes({ ...current, payment: { ...current.payment, quoteCurrency: currency, exchangeRate: null }, freight: { ...current.freight, currency }, logisticsFees: current.logisticsFees.map((fee) => ({ ...fee, currency })) });
            }}
          />
        </TabsContent>


      </Tabs>
      {embedded ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : <DialogFooter className="shrink-0">{actions}</DialogFooter>}
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
          <DialogContent
            className="max-h-[96dvh] w-[min(98vw,120rem)] max-w-none flex-col gap-4 sm:max-w-none"
            style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <DialogHeader className="shrink-0">
              <DialogTitle>{quoteStep ? `Bước báo giá · ${quote.code}` : `Báo giá ${quote.code}`}</DialogTitle>
            </DialogHeader>
            {sheet}
          </DialogContent>
        </Dialog>
      )}

      {outputPick && (
        <QuoteLanguageDialog
          action={outputPick.action}
          initial={printLang}
          getMissing={(lang) => missingFor(outputPick.order ?? selectedOrder, lang)}
          onConfirm={confirmOutput}
          onClose={() => setOutputPick(null)}
        />
      )}

      {contractOpen && lane && (
        <ContractCreateDialog
          lane={lane}
          quote={{ ...quote, ...lead, orders, notes }}
          onClose={() => setContractOpen(false)}
          onCreated={() => {
            setContractStatus("DA_TAO");
            setContractOpen(false);
            onContractCreated?.();
          }}
        />
      )}

      {draft && (
        <OrderDraftDialog
          key={`${draft.order.id}:${draft.mode}`}
          mode={draft.mode}
          order={draft.order}
          shippingMode={lead.shippingMode}
          pending={pending}
          sourcingSale={sourcingSale}
          pureLogistics={pureLogistics}
          saleLogisticsOrder={saleLogisticsOrder && !isFcl}
          showPackaging={showPackaging && !isFcl}
          canEditContent={canEditContent}
          canEditOrderPrices={canEditOrderPrices}
          canEditPackaging={canEditPackaging}
          printLang={printLang}
          quoteCode={quote.code}
          fieldId={fieldId}
          pdfPending={pdfPending}
          previewHtml={previewHtml}
          onClose={() => setDraft(null)}
          onPersist={persistDraft}
          onOutput={(action, order) => setOutputPick({ action, order })}
        />
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
          const priced = orders.length > 0
            ? orders
            : quote.sourcingContext
              ? [{ ...quote.sourcingContext.order, selected: true }]
              : orders;
          const ready = priced.some((order) => order.selected)
            ? priced
            : priced.map((order, index) => ({ ...order, selected: index === 0 }));
          const data = payloadFor(ready);
          if (!data) return;
          if (!data.notes.validityDays) {
            setFormError("Nhập số ngày hiệu lực báo giá trước khi gửi");
            return;
          }
          void onSend(data).then((status) => {
            if (status && quoteStatusOptions.some((item) => item[0] === status)) {
              setQuoteStatus(status as (typeof quoteStatusOptions)[number][0]);
            }
            if (
              status
              && desk === "sourcing"
              && isCombinedSourcing(quote)
              && onContinueLogistics
            ) {
              setLogisticsHandoff(true);
            }
          });
        }}
      />
      <ConfirmDialog
        open={logisticsHandoff}
        onOpenChange={setLogisticsHandoff}
        title="Gửi qua Logistics"
        description="Gửi thông tin đơn hàng đã chốt và thông báo cho nhân sự Logistics lập báo giá vận chuyển."
        confirmLabel="Gửi qua Logistics"
        onConfirm={() => {
          setLogisticsHandoff(false);
          void onContinueLogistics?.();
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
