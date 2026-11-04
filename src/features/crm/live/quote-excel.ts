import { downloadBlob } from "@/lib/download";
import { quoteFileBase, quoteSheetInputOf, safeQuoteFilename, type QuoteLang, type QuoteSheetInput } from "@speego/shared";
import type { CellValue, Workbook, Worksheet } from "exceljs";
import { SPEEGO_LOGO_DATA_URL } from "./quote-logo";
import { buildQuoteSheet, orderForQuotePdf, type QuotePdfSource } from "./quote-sheet";

const NAVY = "FF082A59";
const ORANGE = "FFF26522";
const PALE = "FFF6F8FC";
const BORDER = { style: "thin", color: { argb: "FFC5D0DE" } } as const;
const NUMBER_FORMAT = "#,##0.##";

type ImagePayload = { base64: string; extension: "png" | "jpeg" } | null;
type Row = ReturnType<Worksheet["getRow"]>;

/** Base64 theo từng khúc, tránh nối chuỗi từng byte với ảnh lớn. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x4000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x4000));
  }
  return btoa(binary);
}

/** Ảnh data URL hoặc https; lỗi tải (CORS, mạng) thì bỏ qua ảnh đó. */
async function loadImage(source: string): Promise<ImagePayload> {
  const data = /^data:image\/(png|jpeg|webp);base64,(.+)$/i.exec(source);
  if (data) {
    const kind = data[1]!.toLowerCase();
    return kind === "webp" ? null : { base64: data[2]!, extension: kind === "png" ? "png" : "jpeg" };
  }
  if (!/^https:\/\//.test(source)) return null;
  try {
    const response = await fetch(source);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/image\/(png|jpe?g)/i.test(type)) return null;
    return { base64: toBase64(new Uint8Array(await response.arrayBuffer())), extension: /png/i.test(type) ? "png" : "jpeg" };
  } catch {
    return null;
  }
}

/** Tải song song, mỗi ảnh khác nhau chỉ tải một lần. */
async function loadImages(sources: string[]): Promise<Map<string, ImagePayload>> {
  const unique = [...new Set(sources)];
  const payloads = await Promise.all(unique.map(loadImage));
  return new Map(unique.map((source, index) => [source, payloads[index]!]));
}

function styleHeader(row: Row) {
  row.height = 34;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: BORDER, left: BORDER, bottom: { style: "medium", color: { argb: ORANGE } }, right: BORDER };
  });
}

function boxRow(row: Row, from: number, to: number) {
  for (let col = from; col <= to; col += 1) {
    row.getCell(col).border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
  }
}

type ExcelColumn = { key: string; width: number };

/** Dựng workbook báo giá. Thành tiền và tổng là công thức để sửa tay vẫn tự tính lại. */
async function buildQuoteWorkbook(input: QuoteSheetInput): Promise<Workbook> {
  const model = buildQuoteSheet(input);
  const { t } = model;
  // Thư viện Excel và ảnh tải song song.
  const [{ default: ExcelJS }, images] = await Promise.all([
    import("exceljs"),
    loadImages([SPEEGO_LOGO_DATA_URL, ...model.lines.flatMap((line) => line.images.slice(0, 1))]),
  ]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = model.company.name;
  const ws = workbook.addWorksheet(model.meta.code ? model.meta.code.slice(0, 28) : t.title, {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }],
  });
  const imageIds = new Map<string, number>();
  const placeImage = (source: string, position: Parameters<Worksheet["addImage"]>[1]) => {
    const payload = images.get(source);
    if (!payload) return;
    let id = imageIds.get(source);
    if (id === undefined) {
      id = workbook.addImage({ base64: payload.base64, extension: payload.extension });
      imageIds.set(source, id);
    }
    ws.addImage(id, position);
  };

  // Cột: STT | Hình ảnh | Số lượng | Cách tính | Số nhân | Đơn giá | Thành tiền | [giá+tiền theo tiền thêm]... | [m2] | CBM | Quy cách | Note
  const cols: ExcelColumn[] = [
    { key: "stt", width: 7 }, { key: "image", width: 22 }, { key: "qty", width: 11 }, { key: "basis", width: 11 },
    { key: "base", width: 13 }, { key: "price", width: 14 }, { key: "total", width: 16 },
  ];
  for (const code of model.extraCurrencies) cols.push({ key: `price-${code}`, width: 14 }, { key: `total-${code}`, width: 16 });
  if (model.showArea) cols.push({ key: "area", width: 11 });
  cols.push({ key: "cbm", width: 10 }, { key: "spec", width: 34 }, { key: "note", width: 34 });
  cols.forEach((col, index) => { ws.getColumn(index + 1).width = col.width; });
  const colOf = (key: string) => cols.findIndex((col) => col.key === key) + 1;
  const last = cols.length;
  const letter = (key: string) => ws.getColumn(colOf(key)).letter;

  let r = 1;
  const text = (row: number, col: number, value: string, opts: { bold?: boolean; color?: string; size?: number; merge?: number; align?: "left" | "center" | "right" } = {}) => {
    const cell = ws.getCell(row, col);
    cell.value = value;
    cell.font = { bold: opts.bold, color: opts.color ? { argb: opts.color } : undefined, size: opts.size };
    cell.alignment = { vertical: "middle", horizontal: opts.align ?? "left", wrapText: true };
    if (opts.merge && opts.merge > 1) ws.mergeCells(row, col, row, col + opts.merge - 1);
  };

  // Đầu thư
  placeImage(SPEEGO_LOGO_DATA_URL, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 46 } });
  text(r, 3, model.company.name, { bold: true, color: NAVY, size: 13, merge: last - 2 });
  ws.getRow(r).height = 36;
  r += 1;
  for (const [label, value] of model.company.rows) {
    text(r, 3, `${label}: ${value}`, { merge: last - 2 });
    r += 1;
  }
  r += 1;
  text(r, 1, t.title, { bold: true, color: NAVY, size: 18, merge: last, align: "center" });
  ws.getRow(r).height = 30;
  r += 2;

  // Thông tin khách hàng
  text(r, 1, t.customerInfo, { bold: true, color: NAVY, merge: last });
  r += 1;
  const infoRows: [string, string][] = [
    [t.quoteNo, model.meta.code],
    [t.issuedOn, model.meta.issuedOn],
    [t.orderName, model.meta.orderName],
    ...model.customerRows,
  ];
  for (const [label, value] of infoRows) {
    if (!value) continue;
    text(r, 1, label, { bold: true, merge: 2 });
    text(r, 3, value, { merge: last - 2 });
    boxRow(ws.getRow(r), 1, last);
    r += 1;
  }
  r += 1;
  text(r, 1, t.orderDetails, { bold: true, color: "FFFFFFFF", merge: last, align: "center" });
  ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  r += 1;

  // Tiêu đề cột
  const header = ws.getRow(r);
  const heads: Record<string, string> = {
    stt: t.stt,
    image: t.image,
    qty: t.quantity,
    basis: t.pricingBasis,
    base: t.pricingQty,
    price: `${t.unitPrice} (${model.currency})`,
    total: `${t.lineTotal} (${model.currency})`,
    area: t.area,
    cbm: t.cbm,
    spec: t.spec,
    note: t.note,
  };
  for (const code of model.extraCurrencies) {
    heads[`price-${code}`] = `${t.unitPrice} (${code})`;
    heads[`total-${code}`] = `${t.lineTotal} (${code})`;
  }
  cols.forEach((col, index) => { header.getCell(index + 1).value = heads[col.key] ?? ""; });
  styleHeader(header);
  r += 1;

  // Dòng hàng
  const firstRow = r;
  for (const line of model.lines) {
    const row = ws.getRow(r);
    row.getCell(colOf("stt")).value = line.stt;
    row.getCell(colOf("qty")).value = line.quantity ?? undefined;
    row.getCell(colOf("basis")).value = line.basis === "unit" ? t.defaultUnit : line.priceUnit.replace("/", "") || line.basis;
    row.getCell(colOf("base")).value = line.pricingBase ?? undefined;
    row.getCell(colOf("price")).value = line.price ?? undefined;
    row.getCell(colOf("total")).value = { formula: `${letter("base")}${r}*${letter("price")}${r}`, result: line.total ?? undefined };
    for (const extra of line.extra) {
      row.getCell(colOf(`price-${extra.currency}`)).value = extra.price ?? undefined;
      row.getCell(colOf(`total-${extra.currency}`)).value = {
        formula: `${letter("base")}${r}*${letter(`price-${extra.currency}`)}${r}`,
        result: extra.total ?? undefined,
      };
    }
    if (model.showArea) row.getCell(colOf("area")).value = line.area ?? undefined;
    row.getCell(colOf("cbm")).value = line.cbm ?? undefined;
    row.getCell(colOf("spec")).value = line.spec;
    row.getCell(colOf("note")).value = line.note;
    row.height = line.images.length > 0 ? 96 : Math.max(24, 15 * Math.max(line.spec.split("\n").length, line.note.split("\n").length));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.alignment = { vertical: "top", wrapText: true, horizontal: col === colOf("stt") ? "center" : undefined };
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      if (typeof cell.value === "number" || (cell.value && typeof cell.value === "object" && "formula" in cell.value)) cell.numFmt = NUMBER_FORMAT;
    });
    if (line.images[0]) {
      placeImage(line.images[0], { tl: { col: colOf("image") - 1 + 0.05, row: r - 1 + 0.05 }, ext: { width: 130, height: 120 }, editAs: "oneCell" });
    }
    r += 1;
  }
  if (model.lines.length === 0) {
    text(r, 1, t.empty, { merge: last, align: "center" });
    r += 1;
  }
  const lastRow = r - 1;

  // Tổng
  const sumRow = (label: string) => {
    const row = ws.getRow(r);
    ws.mergeCells(r, 1, r, 4);
    const cell = row.getCell(1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALE } };
    boxRow(row, 1, last);
    return row;
  };
  const put = (row: Row, key: string, value: CellValue) => {
    const cell = row.getCell(colOf(key));
    cell.value = value;
    cell.numFmt = NUMBER_FORMAT;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  };
  const dataRange = (key: string) => `${letter(key)}${firstRow}:${letter(key)}${lastRow}`;

  if (model.totals.priced || model.weightNote) {
    const row = sumRow(model.totalLabel);
    if (model.totals.priced) put(row, "total", { formula: `SUM(${dataRange("total")})`, result: model.totals.goods ?? undefined });
    for (const code of model.extraCurrencies) {
      if (model.totals.extra[code] != null) put(row, `total-${code}`, { formula: `SUM(${dataRange(`total-${code}`)})`, result: model.totals.extra[code] ?? undefined });
    }
    if (model.showArea && model.totals.area > 0) put(row, "area", { formula: `SUM(${dataRange("area")})`, result: model.totals.area });
    if (model.totals.cbm > 0) put(row, "cbm", { formula: `SUM(${dataRange("cbm")})`, result: model.totals.cbm });
    if (model.weightNote) row.getCell(colOf("note")).value = model.weightNote;
    r += 1;
  }
  /** Tiền thêm có cột riêng; tiền khác vào cột Thành tiền kèm mã tiền ở cột Số tính giá. */
  const feeKey = (currency: string) => (model.extraCurrencies.includes(currency) ? `total-${currency}` : "total");
  for (const fee of model.fees) {
    const row = sumRow(fee.label || t.logisticsFee);
    if (fee.amount != null) {
      put(row, feeKey(fee.currency), fee.amount);
      if (feeKey(fee.currency) === "total" && fee.currency !== model.currency) row.getCell(colOf("base")).value = fee.currency;
    } else {
      row.getCell(colOf("total")).value = fee.text;
    }
    r += 1;
  }
  if (model.shippingText) {
    const row = sumRow(t.shippingTotal);
    if (model.shippingAmount != null) put(row, "total", model.shippingAmount);
    else row.getCell(colOf("total")).value = model.shippingText;
    if (model.validityNote) row.getCell(colOf("note")).value = model.validityNote;
    r += 1;
  }
  if (model.feeSubtotals.length > 1 || (model.feeSubtotals.length === 1 && model.fees.length > 1)) {
    for (const sub of model.feeSubtotals) {
      put(sumRow(`${t.feeSubtotal} (${sub.currency})`), feeKey(sub.currency), sub.amount);
      r += 1;
    }
  }
  for (const line of model.deposit) {
    text(r, 1, line, { bold: true, color: NAVY, merge: last });
    boxRow(ws.getRow(r), 1, last);
    r += 1;
  }

  // Thông tin thanh toán (tài khoản ACH) và chữ ký
  r += 1;
  text(r, 1, model.bank.title || t.paymentInfo, { bold: true, color: NAVY, merge: last });
  r += 1;
  for (const [label, value] of model.bank.rows) {
    if (!value.trim()) continue;
    text(r, 1, label, { bold: true, merge: 3 });
    text(r, 4, value, { merge: last - 3 });
    boxRow(ws.getRow(r), 1, last);
    r += 1;
  }
  r += 1;
  const mid = Math.max(2, Math.floor(last / 2));
  text(r, 1, t.partyA, { bold: true, color: NAVY, merge: mid, align: "center" });
  text(r, mid + 1, t.partyB, { bold: true, color: NAVY, merge: last - mid, align: "center" });
  r += 1;
  text(r, 1, t.signStamp, { color: ORANGE, merge: mid, align: "center" });
  text(r, mid + 1, t.signStamp, { color: ORANGE, merge: last - mid, align: "center" });
  ws.getRow(r + 4).height = 20;

  return workbook;
}

/** Tải file .xlsx của báo giá (từ bản nháp hiện tại). `filename` không gồm đuôi. */
export async function downloadQuoteExcel(input: QuoteSheetInput, filename: string): Promise<void> {
  const workbook = await buildQuoteWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    `${safeQuoteFilename(filename)}.xlsx`,
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
}

/** Tải Excel từ bản ghi báo giá (ưu tiên mẫu đang chọn). */
export async function downloadQuoteRecordExcel(quote: QuotePdfSource, lang?: QuoteLang): Promise<void> {
  const order = orderForQuotePdf(quote.orders);
  if (!order) throw new Error("Chưa có mẫu báo giá để xuất Excel");
  await downloadQuoteExcel(quoteSheetInputOf(quote, order, lang), quoteFileBase(quote.code, order.name, lang));
}
