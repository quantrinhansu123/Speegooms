"use client";

import { isCombinedSourcing } from "@speego/shared";

import { Fragment, useState } from "react";
import { Download, Eye, ImagePlus, Pencil, Plus, Printer, RotateCcw, Send, Trash2 } from "lucide-react";
import {
  quoteCurrencies,
  quoteLineImages,
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
import { formatMoneyGrouped } from "@/lib/format";
import { clipboardImage } from "@/lib/clipboard-image";
import { uploadDataImage, uploadImageFile, uploadImageFiles } from "@/lib/upload-image";
import { lineAmount, packageMetrics, pricingBasisLabels, type PricingBasis } from "@/services/crm/quote-lines";
import { downloadQuotePdf, printQuoteSheet, quoteSheetHtml, quoteTotals } from "./quote-print";
import { QuoteSheetPreview } from "./quote-sheet-preview";
import { RequirementImageSlider } from "./requirement-image-slider";

function emptyLine(stt: string): QuoteLine {
  return { stt, image: "", images: [], quantity: null, pricePerSet: null, lineTotal: null, weightKg: null, spec: "", note: "", unit: "set", basis: "unit", cbm: null, packages: [], attrs: [] };
}

function withImages(images: string[]): Pick<QuoteLine, "image" | "images"> {
  const next = images.filter(Boolean).slice(0, 8);
  return { images: next, image: next[0] ?? "" };
}

type SaleFact = [string, string, boolean?];

function SaleFactsTable({ groups }: { groups: { title: string; rows: SaleFact[] }[] }) {
  const cellValue = (value: string) => {
    const empty = !value || value === "—";
    return (
      <td className={`px-3 py-2 text-sm break-words whitespace-pre-wrap ${empty ? "text-muted-foreground/70" : "font-medium"}`}>
        {value}
      </td>
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
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
              <Fragment key={group.title}>
                <tr className="border-b bg-muted/50">
                  <th colSpan={4} className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.title}
                  </th>
                </tr>
                {pairs.map((pair, index) => {
                  if (pair.length === 1 && pair[0]![2]) {
                    const [label, value] = pair[0]!;
                    const empty = !value || value === "—";
                    return (
                      <tr key={`${group.title}-${label}-${index}`} className="border-b last:border-0">
                        <th className="w-[9rem] whitespace-nowrap bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground align-top">{label}</th>
                        <td colSpan={3} className={`px-3 py-2 text-sm break-words whitespace-pre-wrap ${empty ? "text-muted-foreground/70" : "font-medium"}`}>{value}</td>
                      </tr>
                    );
                  }
                  const left = pair[0]!;
                  const right = pair[1];
                  return (
                    <tr key={`${group.title}-${left[0]}-${index}`} className="border-b last:border-0">
                      <th className="w-[9rem] whitespace-nowrap bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground align-top">{left[0]}</th>
                      {cellValue(left[1])}
                      {right ? (
                        <>
                          <th className="w-[9rem] whitespace-nowrap bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground align-top">{right[0]}</th>
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

function amountText(value: number | null): string {
  return value == null ? "" : String(value);
}

function filledLine(line: QuoteLine): boolean {
  return Boolean(line.stt || quoteLineImages(line).length > 0 || line.quantity != null || line.pricePerSet != null || line.lineTotal != null || line.weightKg != null || line.spec || line.note || line.packages.length > 0);
}

function packagesSummary(packages: QuoteLine["packages"]): string {
  const m = packageMetrics(packages);
  return `${m.count} kiện · ${m.cbm} cbm · tính cước ${m.chargeableKg} kg`;
}

const factoryAttrKeys = ["Chất liệu", "MOQ", "Lead time", "Bảo hành"] as const;

function attrValue(attrs: QuoteLine["attrs"], key: string): string {
  return attrs.find((item) => item.key === key)?.value ?? "";
}

function withAttr(attrs: QuoteLine["attrs"], key: string, value: string): QuoteLine["attrs"] {
  const known = new Set<string>(factoryAttrKeys);
  const extras = attrs.filter((item) => !known.has(item.key) && (item.key.trim() || item.value.trim()));
  const next = factoryAttrKeys
    .map((itemKey) => {
      const nextValue = itemKey === key ? value : attrValue(attrs, itemKey);
      return nextValue.trim() ? { key: itemKey, value: nextValue.trim() } : null;
    })
    .filter((item) => item != null);
  return [...next, ...extras];
}

function LinePackagesEditor({
  line,
  lineLabel,
  canEdit,
  onChange,
}: {
  line: QuoteLine;
  lineLabel: string;
  canEdit: boolean;
  onChange: (packages: QuoteLine["packages"]) => void;
}) {
  return (
    <div
      className={`grid gap-2 rounded-md border-2 p-3 ${
        line.packages.length === 0
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
          <span className="text-xs text-amber-900">{packagesSummary(line.packages)}</span>
        )}
      </div>
      <p className="text-[11px] text-amber-900/80">Số kiện · D × R × C (cm) · kg/kiện — dùng để báo giá và tính cước.</p>
      {line.packages.map((pkg, pi) => (
        <div key={pi} className="flex flex-wrap items-center gap-1">
          {(["count", "lengthCm", "widthCm", "heightCm", "actualKg"] as const).map((key) => (
            <Input
              key={key}
              className="h-8 w-[4.5rem] border-amber-700/30 bg-white"
              inputMode="decimal"
              placeholder={{ count: "Số kiện", lengthCm: "D cm", widthCm: "R cm", heightCm: "C cm", actualKg: "kg/kiện" }[key]}
              aria-label={`Kiện ${pi + 1} ${lineLabel}: ${key}`}
              value={pkg[key] ? String(pkg[key]) : ""}
              disabled={!canEdit}
              onChange={(event) => onChange(line.packages.map((x, xi) => (xi === pi ? { ...x, [key]: amountValue(event.target.value) ?? 0 } : x)))}
            />
          ))}
          {canEdit && (
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Xóa kiện ${pi + 1}`} onClick={() => onChange(line.packages.filter((_, xi) => xi !== pi))}>
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
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
  return formatMoneyGrouped(value);
}

/** Tổng số lượng gom theo đơn vị tính, vd "120 set, 30 kg". */
function orderQuantityText(lines: QuoteLine[]): string {
  const byUnit = new Map<string, number>();
  for (const line of lines) {
    if (line.quantity == null) continue;
    const unit = line.unit?.trim() || "set";
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

/** Đơn giá từng dòng kèm đơn vị tính theo cách tính giá, vd "120.000 VND/set". */
function orderPriceTexts(lines: QuoteLine[], currency: string): string[] {
  return lines
    .filter((line) => line.pricePerSet != null)
    .map((line) => {
      const unit = line.basis === "kg" ? "kg" : line.basis === "cbm" ? "CBM" : line.basis === "lump" ? "trọn gói" : line.unit?.trim() || "set";
      return `${money(line.pricePerSet!)} ${currency}/${unit}`;
    });
}

function orderNoteText(lines: QuoteLine[]): string {
  return lines.map((line) => line.note.trim()).filter(Boolean).join("\n");
}

function safeImage(value: string): string {
  if (value.startsWith("data:image/") || value.startsWith("https://")) return value;
  return "";
}

function OrderLines({
  lines,
  currency,
  canEditContent,
  canEditPricing,
  packagingRequired,
  canEditPackaging,
  onChange,
  onError,
}: {
  lines: QuoteLine[];
  currency: QuoteCurrency;
  canEditContent: boolean;
  canEditPricing: boolean;
  packagingRequired: boolean;
  canEditPackaging: boolean;
  onChange: (lines: QuoteLine[]) => void;
  onError: (message: string) => void;
}) {
  const updateLine = (index: number, patch: Partial<QuoteLine>) => {
    onChange(lines.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      let next = { ...line, ...patch };
      if ("packages" in patch && next.packages.length > 0) {
        const m = packageMetrics(next.packages);
        next = { ...next, cbm: m.cbm, weightKg: m.chargeableKg };
      }
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
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs">
              <th className="whitespace-nowrap px-2 py-2 font-medium">STT</th>
              <th className="min-w-[160px] whitespace-nowrap px-2 py-2 font-medium">Hình ảnh</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">SL / ĐV</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Đơn giá ({currency})</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Thành tiền</th>
              <th className="min-w-[120px] whitespace-nowrap px-2 py-2 font-medium">Thông số</th>
              <th className="min-w-[220px] whitespace-nowrap px-2 py-2 font-medium">Thuộc tính xưởng</th>
              <th className="min-w-[100px] whitespace-nowrap px-2 py-2 font-medium">Note</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const images = quoteLineImages(line);
              const showMetric = line.basis === "kg" || line.basis === "cbm";
              return (
                <tr key={index} className="border-b align-top last:border-0">
                  <td className="px-2 py-2">
                    <Input className="h-8 w-12" aria-label={`STT dòng ${index + 1}`} value={line.stt} disabled={!canEditContent} onChange={(event) => updateLine(index, { stt: event.target.value })} />
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
                      <Input className="h-8" inputMode="decimal" aria-label={`Số lượng dòng ${index + 1}`} value={amountText(line.quantity)} disabled={!canEditContent} onChange={(event) => updateLine(index, { quantity: amountValue(event.target.value) })} placeholder="SL" />
                      <Input className="h-8" aria-label={`Đơn vị dòng ${index + 1}`} value={line.unit} disabled={!canEditContent} onChange={(event) => updateLine(index, { unit: event.target.value })} placeholder="ĐV" />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="grid w-36 gap-1">
                      <MoneyInput className="h-8" aria-label={`Đơn giá dòng ${index + 1}`} value={line.pricePerSet} disabled={!canEditPricing} onValueChange={(pricePerSet) => updateLine(index, { pricePerSet })} />
                      <NativeSelect className="h-8 text-xs" aria-label={`Cách tính giá dòng ${index + 1}`} value={line.basis} disabled={!canEditPricing} onChange={(event) => updateLine(index, { basis: event.target.value as PricingBasis })}>
                        {(Object.keys(pricingBasisLabels) as PricingBasis[]).map((b) => <option key={b} value={b}>{pricingBasisLabels[b]}</option>)}
                      </NativeSelect>
                      {showMetric && (
                        <Input
                          className="h-8"
                          inputMode="decimal"
                          aria-label={line.basis === "kg" ? `Cân nặng dòng ${index + 1}` : `CBM dòng ${index + 1}`}
                          value={amountText(line.basis === "kg" ? line.weightKg : line.cbm)}
                          disabled={!canEditContent}
                          onChange={(event) => updateLine(index, line.basis === "kg" ? { weightKg: amountValue(event.target.value) } : { cbm: amountValue(event.target.value) })}
                          placeholder={line.basis === "kg" ? "KG" : "CBM"}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <MoneyInput className="h-8 w-28" aria-label={`Thành tiền dòng ${index + 1}`} value={line.lineTotal} disabled={!canEditPricing} onValueChange={(lineTotal) => updateLine(index, { lineTotal })} />
                  </td>
                  <td className="px-2 py-2">
                    <Textarea className="min-h-16 w-36" aria-label={`Thông số dòng ${index + 1}`} value={line.spec} disabled={!canEditContent} onChange={(event) => updateLine(index, { spec: event.target.value })} placeholder="Thông số" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="grid w-[14.5rem] grid-cols-2 gap-1.5">
                      {factoryAttrKeys.map((key) => (
                        <Input
                          key={key}
                          className="h-8 text-xs"
                          aria-label={`${key} dòng ${index + 1}`}
                          value={attrValue(line.attrs, key)}
                          disabled={!canEditContent}
                          onChange={(event) => updateLine(index, { attrs: withAttr(line.attrs, key, event.target.value) })}
                          placeholder={key}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Textarea className="min-h-16 w-32" aria-label={`Note dòng ${index + 1}`} value={line.note} disabled={!canEditContent} onChange={(event) => updateLine(index, { note: event.target.value })} placeholder="Note" />
                  </td>
                  <td className="px-2 py-2">
                    {canEditContent && (
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Xóa dòng ${index + 1}`} onClick={() => onChange(lines.filter((_, lineIndex) => lineIndex !== index))}>
                        <Trash2 />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-2">
          {packagingRequired && (
            <LinePackagesEditor line={line} lineLabel={`STT ${line.stt || index + 1}`} canEdit={canEditPackaging} onChange={(packages) => updateLine(index, { packages })} />
          )}
          <div className="grid content-start gap-2">
            <label className="grid gap-2 text-sm">
              <span>{`Trọng lượng (kg) · STT ${line.stt || index + 1}`}</span>
              <Input inputMode="decimal" value={amountText(line.weightKg)} disabled={!canEditContent} onChange={(event) => updateLine(index, { weightKg: amountValue(event.target.value) })} />
            </label>
            <p className="text-sm font-medium">Thuộc tính xưởng khác</p>
            {line.attrs.map((attr, attrIndex) => factoryAttrKeys.some((key) => key === attr.key) ? null : (
              <div key={attrIndex} className="flex items-center gap-1">
                <Input aria-label={`Tên thuộc tính ${attrIndex + 1} dòng ${index + 1}`} value={attr.key} disabled={!canEditContent} onChange={(event) => updateLine(index, { attrs: line.attrs.map((item, i) => i === attrIndex ? { ...item, key: event.target.value } : item) })} />
                <Input aria-label={`Giá trị thuộc tính ${attrIndex + 1} dòng ${index + 1}`} value={attr.value} disabled={!canEditContent} onChange={(event) => updateLine(index, { attrs: line.attrs.map((item, i) => i === attrIndex ? { ...item, value: event.target.value } : item) })} />
                {canEditContent && <Button type="button" size="icon-sm" variant="ghost" aria-label="Xóa thuộc tính" onClick={() => updateLine(index, { attrs: line.attrs.filter((_, i) => i !== attrIndex) })}><Trash2 /></Button>}
              </div>
            ))}
            {canEditContent && <Button type="button" variant="outline" className="w-fit" onClick={() => updateLine(index, { attrs: [...line.attrs, { key: "", value: "" }] })}><Plus />Thêm thuộc tính</Button>}
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
}

export type QuoteEditMode = "none" | "content" | "full";

export function QuoteEditor({
  quote,
  templates,
  canEdit = false,
  editMode,
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
  desk,
  onContinueLogistics,
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
  onSend?: (input: UpdateQuoteInput) => Promise<string | null>;
  onReturn?: () => Promise<string | null>;
  embedded?: boolean;
  heading?: string;
  allowContract?: boolean;
  lane?: CrmLane;
  onContractCreated?: () => void;
  desk?: "sourcing" | "logistics";
  /** Sau khi gửi báo giá sourcing xong (KH sourcing+logistics), chuyển sang bàn logistics. */
  onContinueLogistics?: () => void;
}) {
  const mode: QuoteEditMode = editMode ?? (canEdit ? "full" : "none");
  const packagingRequired = desk === "logistics" || !isCombinedSourcing(quote);
  const canEditContent = mode === "content" || mode === "full";
  const canEditPricing = mode === "full";
  const canEditPackaging = canEditContent && (quote.quoteWorkflow === "LEGACY" || canEditPricing);
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
  const [extraCurrencies, setExtraCurrencies] = useState<string[]>([]);
  const [removing, setRemoving] = useState<QuoteOrder | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [logisticsHandoff, setLogisticsHandoff] = useState(false);
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
    if (packagingRequired && canEditPackaging && parsed.data.lines.some((line) => line.packages.length === 0)) {
      setOrderError("Mỗi dòng hàng cần quy cách đóng gói (số kiện, kích thước, kg/kiện)");
      return;
    }
    const next = draft.mode === "create"
      ? [...orders, parsed.data]
      : orders.map((order) => (order.id === parsed.data.id ? parsed.data : order));
    const ok = await persist(next, false);
    if (ok) setDraft(null);
  };

  const toggle = (id: string, checked: boolean) => {
    if (!canEditPricing) return;
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
      {canEditPricing && onSend && <Button type="button" disabled={pending} onClick={() => setConfirmSend(true)}><Send />Gửi báo giá</Button>}
      {!canEditPricing && onReturn && sent && <Button type="button" disabled={pending} onClick={() => setConfirmReturn(true)}><RotateCcw />Gửi lại báo giá</Button>}
      {allowContract && !embedded && lane && contractStatus !== "DA_TAO" && (
        <Button type="button" variant="outline" onClick={() => setContractOpen(true)}>Chuyển Hợp đồng</Button>
      )}
      {!embedded && <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>}
      {canEditContent && <Button type="button" disabled={pending} onClick={save}>{pending ? "Đang lưu…" : "Lưu"}</Button>}
    </>
  );

  const tabTriggerClass =
    "h-14 min-h-14 flex-1 items-center justify-center rounded-xl px-4 py-3 text-base font-bold tracking-wide text-foreground shadow-none after:hidden hover:bg-background/70 hover:text-foreground data-active:bg-primary data-active:text-primary-foreground data-active:shadow-md data-active:hover:bg-primary data-active:hover:text-primary-foreground sm:text-lg";
  const tabPanelClass = embedded
    ? "mt-3 space-y-4"
    : "mt-3 max-h-[min(72vh,780px)] space-y-4 overflow-y-auto pr-1";
  const defaultTab = desk === "logistics" ? "logistics" : desk === "sourcing" ? "sourcing" : "sale";
  const brandLabel = brandOptions.find((item) => item[0] === quote.brand)?.[1] ?? quote.brand ?? "—";
  const logisticsLeadFacts: [string, string][] = [
    ["Quy cách đóng gói (tiềm năng)", quote.packSpec || "—"],
    ["Trọng lượng (kg)", quote.weightKg == null ? "—" : String(quote.weightKg)],
    ["Phân loại logistics", quote.logisticsClass || "—"],
    ["Địa chỉ gửi", quote.shipFromAddress || "—"],
    ["Địa chỉ nhận", quote.shipToAddress || "—"],
  ];
  const requirementImages = quote.requirementImages ?? [];
  const saleFact = (value: string | null | undefined) => (value && value.trim() ? value : "—");
  const saleContactFacts: [string, string, boolean?][] = [
    ["Tên khách", saleFact(quote.customerName)],
    ["Công ty", saleFact(quote.companyName)],
    ["Số điện thoại", saleFact(quote.phone)],
    ["Email", saleFact(quote.email)],
    ["Địa chỉ", saleFact(quote.address), true],
  ];
  const saleProfileFacts: [string, string][] = [
    ["Nguồn", brandLabel],
    ["Giai đoạn", labelOf(potentialOptions, quote.potential)],
    ["Loại khách", labelOf(customerKindOptions, quote.customerKind)],
    ["Đối tượng", labelOf(customerTypeOptions, quote.customerType)],
    ["Kênh chăm sóc", labelOf(careChannelOptions, quote.careChannel)],
    ["Phân loại", labelOf(classificationOptions, quote.classification)],
  ];
  const saleNeedFacts: [string, string, boolean?][] = [
    ["Hàng hóa", saleFact(quote.goods), true],
    ["Số lượng", saleFact(quote.quantityNote)],
    ["Yêu cầu của khách", saleFact(quote.requirements), true],
    ["Ghi chú sale", saleFact(quote.saleNote), true],
  ];
  const saleLogisticsFacts: [string, string, boolean?][] = [
    ["Quy cách đóng gói", saleFact(quote.packSpec)],
    ["Trọng lượng (kg)", quote.weightKg == null ? "—" : String(quote.weightKg)],
    ["Phân loại logistics", saleFact(quote.logisticsClass)],
    ["Địa chỉ gửi", saleFact(quote.shipFromAddress), true],
    ["Địa chỉ nhận", saleFact(quote.shipToAddress), true],
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
            const m = packageMetrics(packages);
            next = { ...next, cbm: m.cbm, weightKg: m.chargeableKg };
          }
          const total = lineAmount({ basis: next.basis, quantity: next.quantity, price: next.pricePerSet, weightKg: next.weightKg, cbm: next.cbm });
          if (total != null) next = { ...next, lineTotal: total };
          return next;
        }),
      };
    }));
  };

  const sheet = (
    <>
      {(formError || error) && <InlineAlert>{formError || error}</InlineAlert>}
      {needsNewQuote && canEditPricing && <InlineAlert>Sale đã gửi lại báo giá. Hãy tạo mẫu mới rồi bấm Gửi báo giá.</InlineAlert>}
      {mode === "content" && (
        <InlineAlert>
          Sale điền ảnh, số lượng ở Sourcing. Nhân sự Logistics nhập quy cách đóng gói tại báo giá vận chuyển. Mua hàng bổ sung thuộc tính chi tiết từ xưởng; vận hành điền đơn giá để báo giá.
        </InlineAlert>
      )}
      <Tabs defaultValue={defaultTab} className={embedded ? "grid gap-0" : "min-h-0 flex-1 overflow-hidden"}>
        <TabsList className="h-auto min-h-0 w-full flex-wrap items-stretch justify-start gap-2 rounded-2xl border border-foreground/10 bg-muted p-2 group-data-horizontal/tabs:h-auto">
          {([
            ["sale", "Sale"],
            ["sourcing", "Sourcing"],
            ["logistics", "Logistics"],
          ] as const).map(([value, label]) => (
            <TabsTrigger key={value} value={value} className={tabTriggerClass}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="sale" className={tabPanelClass}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3">
              <span className="rounded-md bg-background px-2.5 py-1 font-mono text-sm font-semibold tracking-wide">{quote.leadCode || "—"}</span>
              {quote.messCode ? (
                <span className="rounded-md border bg-background px-2.5 py-1 font-mono text-sm text-muted-foreground">{quote.messCode}</span>
              ) : null}
              <span className="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
                {labelOf(potentialOptions, quote.potential)}
              </span>
              {quote.linkMess && /^https?:\/\//i.test(quote.linkMess) ? (
                <a href={quote.linkMess} target="_blank" rel="noreferrer" className="ml-auto text-sm font-medium text-primary hover:underline">
                  Mở link mess
                </a>
              ) : null}
            </div>

            <SaleFactsTable
              groups={[
                { title: "Liên hệ", rows: saleContactFacts },
                { title: "Phân loại khách", rows: saleProfileFacts },
              ]}
            />

            <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
              <SaleFactsTable groups={[{ title: "Nhu cầu", rows: saleNeedFacts }]} />
              <div className="overflow-hidden rounded-lg border">
                <div className="border-b bg-muted/50 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ảnh yêu cầu</div>
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

            <SaleFactsTable groups={[{ title: "Logistics (từ tiềm năng)", rows: saleLogisticsFacts }]} />
          </div>
        </TabsContent>

        <TabsContent value="sourcing" className={tabPanelClass}>
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
              {canEditContent && <Button type="button" variant="outline" disabled={pending} onClick={openCreate}><Plus />Tạo thông tin đơn hàng</Button>}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Chọn</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Hình ảnh</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Tên mẫu</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Số lượng</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Đơn giá</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Số kiện</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">CBM</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Cân nặng (kg)</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Cân tính cước (kg)</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Tổng tiền hàng</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Ghi chú</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr><td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">Chưa có thông tin đơn hàng.</td></tr>
                  )}
                  {orders.map((order) => {
                    const totals = quoteTotals(order.lines);
                    const previewImages = order.lines
                      .flatMap((line) => quoteLineImages(line).map(safeImage).filter(Boolean))
                      .slice(0, 6);
                    const quantityText = orderQuantityText(order.lines);
                    const specText = orderSpecText(order.lines);
                    const priceTexts = orderPriceTexts(order.lines, order.currency);
                    const noteText = orderNoteText(order.lines);
                    const packed = packageMetrics(order.lines.flatMap((line) => line.packages));
                    const vndTotal = totals.priced && order.currency !== "VND" && order.rate ? totals.goods * order.rate : null;
                    return (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={order.selected}
                            disabled={!canEditPricing || pending}
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
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{quantityText || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {priceTexts.length === 0 ? <span className="text-muted-foreground">—</span> : (
                            <div className="grid gap-0.5">
                              {priceTexts.slice(0, 2).map((item, index) => <span key={index}>{item}</span>)}
                              {priceTexts.length > 2 && <span className="text-xs text-muted-foreground">+{priceTexts.length - 2} dòng khác</span>}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{totals.packageCount > 0 ? money(totals.packageCount) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{totals.cbm > 0 ? totals.cbm : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{totals.weighed ? money(totals.weight) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{packed.count > 0 ? money(packed.chargeableKg) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {totals.priced ? <span className="font-medium">{money(totals.goods)} {order.currency}</span> : <span className="text-muted-foreground">—</span>}
                          {vndTotal != null && (
                            <p className="text-xs text-muted-foreground">≈ {money(Math.round(vndTotal))} VND (tỷ giá {money(order.rate!)})</p>
                          )}
                        </td>
                        <td className="min-w-40 max-w-xs px-3 py-2">
                          {noteText ? <p className="line-clamp-3 whitespace-pre-line text-xs" title={noteText}>{noteText}</p> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button type="button" size="sm" variant="ghost" onClick={() => { setOrderError(undefined); setDraft({ mode: "view", order }); }}><Eye />Xem</Button>
                            {canEditContent && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setOrderError(undefined); setDraft({ mode: "edit", order: { ...order, lines: order.lines.map((line) => ({ ...line })) } }); }}><Pencil />Sửa</Button>}
                            {canEditContent && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setRemoving(order)}><Trash2 />Xóa</Button>}
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
              <Input id={fieldId("note-total")} value={notes.totalLabel} disabled={!canEditPricing} onChange={(event) => setNotes({ ...notes, totalLabel: event.target.value })} placeholder="Tổng giá trị hàng hóa chưa bao gồm phí vận chuyển" />
            </Field>
            <Field label="Hiệu lực báo giá" htmlFor={fieldId("note-valid")}>
              <Input id={fieldId("note-valid")} value={notes.validityNote} disabled={!canEditPricing} onChange={(event) => setNotes({ ...notes, validityNote: event.target.value })} placeholder="Báo giá có hiệu lực kể từ ngày báo giá (...)" />
            </Field>
            <div className="grid gap-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Thông tin đặt cọc</span>
                {canEditPricing && (
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
                    disabled={!canEditPricing}
                    onChange={(event) => setNotes({ ...notes, deposit: notes.deposit.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })}
                  />
                  {canEditPricing && (
                    <Button type="button" variant="ghost" size="icon" aria-label={`Xóa dòng đặt cọc ${index + 1}`} disabled={pending} onClick={() => setNotes({ ...notes, deposit: notes.deposit.filter((_, itemIndex) => itemIndex !== index) })}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logistics" className={tabPanelClass}>
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
            <h3 className="font-semibold sm:col-span-2">Thông tin logistics từ tiềm năng</h3>
            {logisticsLeadFacts.map(([label, value]) => (
              <p key={label} className={label.startsWith("Quy cách") || label.startsWith("Địa chỉ") ? "sm:col-span-2" : undefined}>
                <span className="text-muted-foreground">{label}: </span>
                <span className="font-medium whitespace-pre-wrap">{value}</span>
              </p>
            ))}
          </div>

          {packagingRequired && <div className="grid gap-3">
            <div>
              <h3 className="font-medium">Quy cách đóng gói theo dòng hàng</h3>
              <p className="text-sm text-muted-foreground">Điền số kiện · D × R × C · kg/kiện cho từng dòng để tính cước và báo giá vận chuyển.</p>
            </div>
            {orders.length === 0 && (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Chưa có thông tin đơn hàng — tạo ở tab Sourcing trước.</p>
            )}
            {orders.map((order) => (
              <div key={order.id} className="grid gap-3 rounded-xl border p-3">
                <p className="font-medium">{order.name || "Không tên"} · {order.currency}</p>
                {order.lines.length === 0 && <p className="text-sm text-muted-foreground">Chưa có dòng hàng.</p>}
                {order.lines.map((line, lineIndex) => (
                  <LinePackagesEditor
                    key={`${order.id}-${lineIndex}`}
                    line={line}
                    lineLabel={`STT ${line.stt || lineIndex + 1}`}
                    canEdit={canEditPackaging}
                    onChange={(packages) => patchOrderLinePackages(order.id, lineIndex, packages)}
                  />
                ))}
              </div>
            ))}
          </div>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ghi chú cân nặng / CBM" htmlFor={fieldId("note-weight")}>
              <Input id={fieldId("note-weight")} value={notes.weightNote} disabled={!canEditPricing} onChange={(event) => setNotes({ ...notes, weightNote: event.target.value })} placeholder="Dự kiến số KG/CBM, có thể thay đổi theo thực tế" />
            </Field>
            <Field label="Tổng chi phí vận chuyển (Logistics)" htmlFor={fieldId("note-shipping")}>
              <Input id={fieldId("note-shipping")} value={notes.shippingLabel ?? ""} disabled={!canEditPricing} onChange={(event) => setNotes({ ...notes, shippingLabel: event.target.value })} placeholder="Tổng chi phí vận chuyển từ ..." />
            </Field>
            <Field label="Tài khoản" htmlFor={fieldId("bank-title")}>
              <Input id={fieldId("bank-title")} value={bank.title} disabled={!canEditPricing} onChange={(event) => setBank({ ...bank, title: event.target.value })} />
            </Field>
            <Field label="Account Name" htmlFor={fieldId("bank-name")}>
              <Input id={fieldId("bank-name")} value={bank.accountName} disabled={!canEditPricing} onChange={(event) => setBank({ ...bank, accountName: event.target.value })} />
            </Field>
            <Field label="Account Number" htmlFor={fieldId("bank-number")}>
              <Input id={fieldId("bank-number")} value={bank.accountNumber} disabled={!canEditPricing} onChange={(event) => setBank({ ...bank, accountNumber: event.target.value })} />
            </Field>
            <Field label="Routing Number" htmlFor={fieldId("bank-routing")}>
              <Input id={fieldId("bank-routing")} value={bank.routingNumber} disabled={!canEditPricing} onChange={(event) => setBank({ ...bank, routingNumber: event.target.value })} />
            </Field>
            <Field label="Mẫu báo giá" htmlFor={fieldId("quote-template")}>
              <NativeSelect id={fieldId("quote-template")} value={templateId} disabled={!canEditPricing} onChange={(event) => setTemplateId(event.target.value)}>
                <option value="">Chưa chọn</option>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Ghi chú VH" htmlFor={fieldId("quote-note")}>
              <Input id={fieldId("quote-note")} value={opsNote} disabled={!canEditPricing} onChange={(event) => setOpsNote(event.target.value)} />
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
          </div>
        </TabsContent>
      </Tabs>
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
          <DialogContent className="flex max-h-[96dvh] w-[min(98vw,120rem)] max-w-none flex-col gap-4 overflow-hidden sm:max-w-none">
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
          <DialogContent className="z-[80] w-[min(96vw,90rem)] max-w-none sm:max-w-none">
            <DialogHeader>
              <DialogTitle>
                {draft.mode === "create" ? "Tạo thông tin đơn hàng" : draft.mode === "edit" ? "Sửa thông tin đơn hàng" : "Xem thông tin đơn hàng"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[68vh] gap-4 overflow-y-auto pr-1">
              {orderError && <InlineAlert>{orderError}</InlineAlert>}
              {draft.mode !== "view" && (
                <InlineAlert>
                  Điền ảnh + số lượng ở đây. Quy cách đóng gói → tab Logistics. Đơn giá do vận hành điền.
                </InlineAlert>
              )}
              <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,12rem)_auto]">
                <Field label="Tên thông tin đơn hàng" htmlFor={fieldId("order-name")}>
                  <Input
                    id={fieldId("order-name")}
                    value={draft.order.name}
                    disabled={draft.mode === "view"}
                    onChange={(event) => setDraft({ ...draft, order: { ...draft.order, name: event.target.value } })}
                    placeholder="VD: Mẫu A — 500 set"
                  />
                </Field>
                <Field label="Loại tiền" htmlFor={fieldId("order-currency")}>
                  <NativeSelect
                    id={fieldId("order-currency")}
                    value={draft.order.currency}
                    disabled={draft.mode === "view" || !canEditPricing}
                    onChange={(event) => {
                      const currency = event.target.value.toUpperCase();
                      setDraft({ ...draft, order: { ...draft.order, currency, rate: currency === "VND" ? null : draft.order.rate } });
                    }}
                  >
                    {Array.from(new Set<string>([...quoteCurrencies, draft.order.currency, ...extraCurrencies]))
                      .filter(Boolean)
                      .map((code) => (
                        <option key={code} value={code}>{code}{code === "VND" ? " (nội tệ)" : ""}</option>
                      ))}
                  </NativeSelect>
                </Field>
                {draft.mode !== "view" && canEditPricing && (
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        const next = window.prompt("Nhập mã tiền tệ mới (3 chữ cái, ví dụ THB)")?.trim().toUpperCase() ?? "";
                        if (!next) return;
                        if (!/^[A-Z]{3}$/.test(next)) {
                          setOrderError("Mã tiền tệ gồm đúng 3 chữ cái");
                          return;
                        }
                        setExtraCurrencies((current) => current.includes(next) ? current : [...current, next]);
                        setDraft({ ...draft, order: { ...draft.order, currency: next, rate: next === "VND" ? null : draft.order.rate } });
                        setOrderError(undefined);
                      }}
                    >
                      Thêm loại tiền
                    </Button>
                  </div>
                )}
                {draft.order.currency !== "VND" && (
                  <Field label={`Tỷ giá (VND / 1 ${draft.order.currency})`} htmlFor={fieldId("order-rate")} hint="Không bắt buộc — có tỷ giá thì sheet in thêm dòng VND" className="sm:col-span-3">
                    <MoneyInput
                      id={fieldId("order-rate")}
                      value={draft.order.rate}
                      disabled={draft.mode === "view" || !canEditPricing}
                      onValueChange={(rate) => setDraft({ ...draft, order: { ...draft.order, rate } })}
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
                  canEditContent={canEditContent}
                  canEditPricing={canEditPricing}
                  packagingRequired={packagingRequired}
                  canEditPackaging={canEditPackaging}
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
          const missingPack = orders.some((order) => order.selected && order.lines.some((line) => line.packages.length === 0));
          if (missingPack) {
            setFormError("Mỗi dòng hàng đã chọn cần quy cách đóng gói ở tab Logistics trước khi gửi báo giá");
            setConfirmSend(false);
            return;
          }
          const data = payloadFor(orders);
          if (!data) return;
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
        title="Chuyển báo giá vận chuyển"
        description="Đã gửi báo giá thông tin đơn hàng. Tiếp tục báo giá thông tin vận chuyển cho khách Sourcing?"
        confirmLabel="Sang Logistics"
        onConfirm={() => {
          setLogisticsHandoff(false);
          onContinueLogistics?.();
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
