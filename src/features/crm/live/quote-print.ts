import { packagesText } from "@/services/crm/quote-lines";
import { quoteLineImages, type QuoteBank, type QuoteCurrency, type QuoteLine, type QuoteNotes, type QuoteOrder } from "@speego/shared";
import { SPEEGO_LOGO_DATA_URL } from "./quote-logo";

export const companyName = "CÔNG TY TNHH SPEEGO LOGISTICS";

/** Tiêu đề bên trái — thông tin bên phải (letterhead). */
export const companyFields: [string, string][] = [
  ["Địa chỉ HN", "Tầng 24, Leadvisors Tower, 643 Phạm Văn Đồng, Phường Nghĩa Đô, HN"],
  ["Địa chỉ HCM", "01 Đường số 4, KDC Cityland Park Hills, phường Gò Vấp, HCM"],
  ["Địa chỉ Mỹ", "7303 Breen Dr, Houston, TX 77086, US"],
  ["Điện thoại", "079.673.8695"],
  ["Email", "sales@speegologistic.com"],
];

/** @deprecated Dùng companyName + companyFields. Giữ để tương thích preview cũ. */
export const companyLines = [
  companyName,
  ...companyFields.map(([label, value]) => `${label}: ${value}`),
];

export interface QuoteCustomer {
  customerName: string | null;
  companyName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export function quoteTotals(lines: QuoteLine[]) {
  const priced = lines.some((line) => line.lineTotal != null);
  const weighed = lines.some((line) => line.weightKg != null);
  const packaged = lines.flatMap((line) => line.packages);
  return {
    packageCount: packaged.reduce((sum, p) => sum + p.count, 0),
    cbm: Math.round(lines.reduce((sum, line) => sum + (line.cbm ?? 0), 0) * 1000) / 1000,
    goods: lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0),
    weight: lines.reduce((sum, line) => sum + (line.weightKg ?? 0), 0),
    priced,
    weighed,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Bảng tiêu đề trái — thông tin phải, cột thẳng hàng. */
function kvTable(rows: [string, string][], emptyFallback?: [string, string]): string {
  const filled = rows.filter(([, value]) => Boolean(value?.trim()));
  const list = filled.length > 0 ? filled : emptyFallback ? [emptyFallback] : [];
  if (list.length === 0) return "";
  const body = list
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");
  return `<table class="kv"><colgroup><col class="kv-label"><col class="kv-value"></colgroup><tbody>${body}</tbody></table>`;
}

/** Nhiều cột label|value trên cùng hàng — giảm số dòng, tăng số cột. */
function kvTableWide(rows: [string, string][], columns = 2, emptyFallback?: [string, string]): string {
  const filled = rows.filter(([, value]) => Boolean(value?.trim()));
  const list = filled.length > 0 ? filled : emptyFallback ? [emptyFallback] : [];
  if (list.length === 0) return "";
  const cells = list.map(([label, value]) => `<th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td>`);
  const body: string[] = [];
  for (let i = 0; i < cells.length; i += columns) {
    const slice = cells.slice(i, i + columns);
    while (slice.length < columns) slice.push("<th></th><td></td>");
    body.push(`<tr>${slice.join("")}</tr>`);
  }
  const cols = Array.from({ length: columns }, () => `<col class="kv-label"><col class="kv-value">`).join("");
  return `<table class="kv kv-wide"><colgroup>${cols}</colgroup><tbody>${body.join("")}</tbody></table>`;
}

function formatAmount(value: number | null, digits = 2): string {
  if (value == null) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(digits, 2),
    maximumFractionDigits: digits,
  }).format(value);
}

/** Giá ngoại tệ quy ra VND theo tỷ giá nhập trong mẫu; null nếu là VND hoặc chưa có tỷ giá. */
export function vndEquivalent(amount: number, currency: QuoteCurrency, rate: number | null): number | null {
  return currency === "VND" || !rate ? null : Math.round(amount * rate);
}

/** Cột Note: ghi chú tay + quy cách đóng gói + thuộc tính, theo cách các mẫu sheet đang trình bày. */
function lineNote(line: QuoteLine): string {
  const attrs = line.attrs.filter((a) => a.key.trim() || a.value.trim()).map((a) => (a.key.trim() ? `${a.key.trim()}: ${a.value.trim()}` : a.value.trim()));
  return [packagesText(line.packages), ...attrs, line.note.trim()].filter(Boolean).join("\n");
}

function imageSrc(value: string): string {
  if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  if (/^https:\/\/[^\s"]+$/.test(value)) return escapeHtml(value);
  return "";
}

function cell(value: string, className = ""): string {
  return `<td class="${className}">${value ? escapeHtml(value).replaceAll("\n", "<br>") : ""}</td>`;
}

function filledLine(line: QuoteLine): boolean {
  return Boolean(
    line.stt.trim()
    || quoteLineImages(line).length > 0
    || line.quantity != null
    || line.pricePerSet != null
    || line.lineTotal != null
    || line.weightKg != null
    || line.cbm != null
    || line.spec.trim()
    || line.note.trim()
    || line.packages.length > 0
    || line.attrs.some((item) => item.key.trim() || item.value.trim()),
  );
}

function totalsConverted(lines: QuoteLine[], currency: QuoteCurrency, rate: number | null): number | null {
  const totals = quoteTotals(lines);
  return totals.priced ? vndEquivalent(totals.goods, currency, rate) : null;
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

/** Một dòng số + đơn vị (số thẳng số, đơn vị thẳng đơn vị). */
function numRow(amount: string, unit = ""): string {
  if (!amount && !unit) return "";
  return `<span class="num-row"><span class="amt">${escapeHtml(amount)}</span><span class="unit">${escapeHtml(unit)}</span></span>`;
}

/** Ô số: phần số thẳng cột, đơn vị cố định bên phải. */
function numCell(amount: string, unit = "", className = "num"): string {
  if (!amount && !unit) return `<td class="${className}"></td>`;
  return `<td class="${className}">${numRow(amount, unit)}</td>`;
}

type SummaryCells = { total?: string; kg?: string; cbm?: string };

function measureCells(weightKg: number | null, cbm: number | null): SummaryCells {
  return {
    kg: weightKg != null ? numRow(formatAmount(weightKg), "KG") : "",
    cbm: cbm != null && cbm > 0 ? numRow(formatAmount(cbm, 3), "CBM") : "",
  };
}

/** Dòng tổng kết: nhãn (4 cột đầu) | Tổng tiền | KG | CBM | Thông tin — thẳng cột với bảng hàng. */
function summaryRow(label: string, cells: SummaryCells = {}, note = ""): string {
  return `<tr>
    <td class="sum-label" colspan="4">${escapeHtml(label)}</td>
    <td class="sum-value">${cells.total ?? ""}</td>
    <td class="sum-value">${cells.kg ?? ""}</td>
    <td class="sum-value">${cells.cbm ?? ""}</td>
    <td class="sum-spec"></td>
    <td class="sum-note">${note ? escapeHtml(note).replaceAll("\n", "<br>") : ""}</td>
  </tr>`;
}

export function quoteSheetHtml(input: {
  customer: QuoteCustomer;
  lines: QuoteLine[];
  currency?: QuoteCurrency;
  rate?: number | null;
  notes: QuoteNotes;
  bank: QuoteBank;
  logoUrl?: string;
  code?: string | null;
  orderName?: string | null;
  issuedOn?: string | null;
}): string {
  const currency = input.currency ?? "VND";
  const lines = input.lines.filter(filledLine);
  const converted = totalsConverted(lines, currency, input.rate ?? null);
  const totals = quoteTotals(lines);
  const issuedOn = input.issuedOn?.trim() || todayLabel();
  const code = input.code?.trim() || "";
  const orderName = input.orderName?.trim() || "";
  const logoUrl = input.logoUrl?.trim() || SPEEGO_LOGO_DATA_URL;

  const rows = lines.map((line) => {
    const images = quoteLineImages(line)
      .map((item) => imageSrc(item))
      .filter(Boolean)
      .map((src) => `<img src="${src}" alt="">`)
      .join("");
    const qtyAmount = line.quantity == null ? "" : formatAmount(line.quantity);
    const qtyUnit = line.quantity == null ? "" : (line.unit && line.unit !== "set" ? line.unit : "");
    const priceAmount = line.pricePerSet == null ? "" : formatAmount(line.pricePerSet);
    const priceUnit = line.pricePerSet == null
      ? ""
      : line.basis === "unit"
        ? currency
        : `/${{ kg: "kg", cbm: "cbm", lump: "gói" }[line.basis]}`;
    const totalAmount = line.lineTotal == null ? "" : formatAmount(line.lineTotal);
    const totalUnit = line.lineTotal == null ? "" : currency;
    const weight = line.weightKg != null ? formatAmount(line.weightKg) : "";
    const volume = line.cbm != null && line.cbm > 0 ? formatAmount(line.cbm, 3) : "";
    const specText = line.spec.trim();
    const noteText = lineNote(line);
    return `<tr>
      ${cell(line.stt, "stt")}
      <td class="image"><div class="image-stack">${images}</div></td>
      ${numCell(qtyAmount, qtyUnit)}
      ${numCell(priceAmount, priceUnit)}
      ${numCell(totalAmount, totalUnit, "num money")}
      ${weight ? numCell(weight, "KG") : `<td class="num"></td>`}
      ${volume ? numCell(volume, "CBM") : `<td class="num"></td>`}
      ${cell(specText, "wrap info")}
      ${cell(noteText, "wrap info")}
    </tr>`;
  }).join("");

  const hasText = (value: string | null | undefined) => Boolean(value?.trim());
  const customerTable = kvTableWide(
    [
      ["Khách hàng", input.customer.customerName ?? ""],
      ["Công ty", input.customer.companyName ?? ""],
      ["Địa chỉ", input.customer.address ?? ""],
      ["Điện thoại", input.customer.phone ?? ""],
      ["Email", input.customer.email ?? ""],
      ["Hiệu lực", input.notes.validityNote?.trim() ?? ""],
    ],
    3,
    ["Khách hàng", "—"],
  );
  const companyTable = kvTableWide(companyFields, 2);
  const certTable = kvTableWide([
    ["Mã báo giá", code || "—"],
    ["Ngày lập", issuedOn],
    ["Mẫu đơn hàng", orderName || "—"],
    ["Loại tiền", currency],
  ], 1);

  const shippingLabel = input.notes.shippingLabel?.trim() ?? "";
  const weightNote = input.notes.weightNote?.trim() ?? "";
  const validityNote = input.notes.validityNote?.trim() ?? "";
  const depositLines = input.notes.deposit.map((line) => line.trim()).filter(Boolean);

  const summaryRows = [
    (totals.priced || weightNote)
      ? summaryRow(
          "Tổng tiền",
          {
            total: totals.priced ? numRow(formatAmount(totals.goods), currency) : "",
            ...measureCells(totals.weighed ? totals.weight : null, totals.cbm > 0 ? totals.cbm : null),
          },
          weightNote,
        )
      : "",
    shippingLabel
      ? summaryRow(
          shippingLabel,
          measureCells(totals.weighed ? totals.weight : null, totals.cbm > 0 ? totals.cbm : null),
          validityNote,
        )
      : "",
    totals.packageCount > 0
      ? summaryRow(
          "Tổng đóng gói",
          { ...measureCells(totals.weight, totals.cbm), total: numRow(formatAmount(totals.packageCount), "kiện") },
        )
      : "",
    converted != null
      ? summaryRow(
          `Quy đổi (1 ${currency} = ${formatAmount(input.rate ?? 0)} VND)`,
          { total: numRow(formatAmount(converted), "VND") },
        )
      : "",
  ].filter(Boolean).join("");

  const depositRows = depositLines.map((line, index) => `<tr>
    <td class="dep-label" colspan="4">${escapeHtml(line)}</td>
    <td class="dep-value">${index === 0 && totals.priced ? numRow(formatAmount(totals.goods), currency) : ""}</td>
  </tr>`).join("");

  const bankParts = [
    hasText(input.bank.accountName) ? `<div><span>Account Name</span>${escapeHtml(input.bank.accountName)}</div>` : "",
    hasText(input.bank.accountNumber) ? `<div><span>Account Number</span>${escapeHtml(input.bank.accountNumber)}</div>` : "",
    hasText(input.bank.routingNumber) ? `<div><span>Routing Number</span>${escapeHtml(input.bank.routingNumber)}</div>` : "",
  ].filter(Boolean).join("");

  const bankBlock = bankParts || hasText(input.bank.title)
    ? `<section class="bank">
        <h2>${escapeHtml(input.bank.title?.trim() || "Thông tin thanh toán")}</h2>
        ${bankParts}
      </section>`
    : "";

  return `<article class="sheet">
  <header class="masthead">
    <div class="brand">
      <img class="logo" src="${escapeHtml(logoUrl)}" alt="SpeeGo Logistics" width="168" height="50">
      <div class="company">
        <strong>${escapeHtml(companyName)}</strong>
        ${companyTable}
      </div>
    </div>
    <div class="meta">
      <p class="meta-heading">Thông tin chứng từ</p>
      ${certTable}
    </div>
  </header>
  <div class="accent-bar" aria-hidden="true"></div>
  <h1 class="doc-title">BÁO GIÁ</h1>

  <section class="party party-wide">
    <h2>Thông tin khách hàng</h2>
    ${customerTable}
  </section>

  <h2 class="banner">CHI TIẾT ĐƠN HÀNG</h2>

  <table class="items">
    <colgroup>
      <col class="c-stt"><col class="c-image"><col class="c-qty"><col class="c-price">
      <col class="c-total"><col class="c-kg"><col class="c-cbm"><col class="c-spec"><col class="c-info">
    </colgroup>
    <thead>
      <tr>
        <th>STT</th>
        <th>Hình ảnh</th>
        <th>SL</th>
        <th>Đơn giá</th>
        <th>Tổng tiền</th>
        <th>KG</th>
        <th>CBM</th>
        <th>Thông số kỹ thuật</th>
        <th>Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="9" class="empty">Chưa có dòng hàng</td></tr>`}
    </tbody>
  </table>

  ${summaryRows ? `<table class="summary"><colgroup>
      <col class="c-stt"><col class="c-image"><col class="c-qty"><col class="c-price">
      <col class="c-total"><col class="c-kg"><col class="c-cbm"><col class="c-spec"><col class="c-info">
    </colgroup><tbody>${summaryRows}</tbody></table>` : ""}

  ${depositRows ? `<table class="summary deposit"><colgroup>
      <col class="c-stt"><col class="c-image"><col class="c-qty"><col class="c-price">
      <col class="c-total"><col class="c-kg"><col class="c-cbm"><col class="c-spec"><col class="c-info">
    </colgroup><tbody>${depositRows}</tbody></table>` : ""}

  ${bankBlock}

  <section class="sign">
    <div>
      <p>ĐẠI DIỆN BÊN A</p>
      <span>(Ký, đóng dấu)</span>
    </div>
    <div>
      <p>ĐẠI DIỆN BÊN B</p>
      <span>(Ký, đóng dấu)</span>
    </div>
  </section>
</article>`;
}

/** Tông màu logo SpeeGo: Navy #082A59, Orange #F26522, nền #F6F8FC. */
export const quotePrintCss = `
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * {
    box-sizing: border-box;
    font-family: "Times New Roman", Times, "Liberation Serif", serif !important;
  }
  body {
    margin: 0;
    color: #082A59;
    background: #fff;
    font-family: "Times New Roman", Times, "Liberation Serif", serif;
    font-size: 10pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet-wrap { padding: 0; }
  .sheet { width: 100%; }

  .masthead {
    display: grid;
    grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr);
    gap: 20px;
    align-items: stretch;
    padding-bottom: 10px;
    border-bottom: 3px solid #082A59;
  }
  .accent-bar {
    height: 4px;
    background: #F26522;
  }
  .brand {
    display: grid;
    grid-template-columns: 190px 1fr;
    gap: 16px;
    align-items: center;
    min-width: 0;
  }
  .logo {
    width: 190px;
    height: auto;
    max-height: 76px;
    object-fit: contain;
    object-position: left center;
  }
  .company {
    min-width: 0;
    border-left: 2px solid #F26522;
    padding-left: 12px;
  }
  .company strong {
    display: block;
    color: #082A59;
    font-size: 11pt;
    letter-spacing: 0.02em;
    margin-bottom: 6px;
    line-height: 1.25;
  }
  .company .kv-label { width: 82px; }
  .company th { width: 82px; }
  .meta {
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid #c5d0de;
    background: #F6F8FC;
  }
  .meta-heading {
    margin: 0 0 6px;
    padding-bottom: 4px;
    border-bottom: 2px solid #F26522;
    color: #082A59;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.25;
  }

  table.kv {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9pt;
  }
  col.kv-label { width: 88px; }
  col.kv-value { width: auto; }
  table.kv th {
    width: 88px;
    padding: 2px 8px 2px 0;
    text-align: left;
    vertical-align: top;
    color: #082A59;
    font-weight: 700;
    white-space: normal;
    line-height: 1.3;
  }
  table.kv td {
    padding: 2px 10px 2px 0;
    text-align: left;
    vertical-align: top;
    color: #1e293b;
    word-break: break-word;
    line-height: 1.3;
  }
  table.kv-wide td:nth-child(even) { padding-right: 14px; }

  .doc-title {
    margin: 8px 0 6px;
    padding: 0;
    color: #082A59;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-align: center;
    line-height: 1.15;
  }

  .party {
    border: 1px solid #c5d0de;
    background: #fff;
    padding: 6px 8px;
    min-width: 0;
    margin: 0 0 8px;
  }
  .party-wide { width: 100%; }
  .party h2 {
    margin: 0 0 4px;
    padding-bottom: 3px;
    border-bottom: 2px solid #F26522;
    color: #082A59;
    font-size: 9.5pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.2;
  }

  .banner {
    margin: 0 0 6px;
    padding: 5px 8px;
    background: #082A59;
    color: #fff;
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-align: center;
    border-left: 6px solid #F26522;
  }

  table.items {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9pt;
  }
  .c-stt { width: 3%; }
  .c-image { width: 14%; }
  .c-qty { width: 6%; }
  .c-price { width: 9%; }
  .c-total { width: 12%; }
  .c-kg { width: 7%; }
  .c-cbm { width: 7%; }
  .c-spec { width: 24%; }
  .c-info { width: 18%; }
  table.items th,
  table.items td {
    border: 1px solid #c5d0de;
    padding: 6px 6px;
    vertical-align: top;
  }
  table.items thead th {
    background: #082A59;
    color: #fff;
    font-weight: 700;
    text-align: center;
    vertical-align: middle;
    border-color: #082A59;
    border-bottom: 3px solid #F26522;
  }
  table.items .stt {
    text-align: center;
    font-weight: 700;
    color: #082A59;
    font-variant-numeric: tabular-nums;
  }
  table.items .num {
    text-align: right;
    white-space: nowrap;
    color: #082A59;
    font-variant-numeric: tabular-nums lining-nums;
  }
  table.items .num-row,
  table.summary .num-row,
  .measure-inline .num-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 2.8em;
    gap: 4px;
    align-items: baseline;
    width: 100%;
    min-height: 1.35em;
  }
  .measure-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    justify-content: flex-end;
    width: 100%;
  }
  .measure-inline .num-row {
    width: auto;
    min-width: 5.5em;
    grid-template-columns: minmax(2.8em, 1fr) 2.4em;
  }
  table.items .amt,
  table.summary .amt,
  .measure-inline .amt {
    text-align: right;
    font-variant-numeric: tabular-nums lining-nums;
    min-height: 1.2em;
  }
  table.items .unit,
  .measure-inline .unit {
    text-align: left;
    color: #64748b;
    font-size: 8.5pt;
    font-weight: 600;
  }
  table.items .money .amt { font-weight: 700; color: #F26522; }
  table.items .money .unit { color: #F26522; }
  table.items .info {
    text-align: left;
    vertical-align: top;
  }
  table.items .image {
    text-align: center;
    padding: 6px;
    vertical-align: top;
  }
  table.items .image-stack {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    align-items: flex-start;
  }
  table.items .image img {
    width: 132px;
    max-width: 132px;
    max-height: 132px;
    object-fit: contain;
  }
  table.items .wrap {
    white-space: pre-wrap;
    text-align: left;
    word-break: break-word;
    color: #1e293b;
    vertical-align: top;
  }
  table.items .empty { text-align: center; color: #64748b; padding: 16px; }

  table.summary {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    table-layout: fixed;
    font-size: 9.5pt;
  }
  table.summary td {
    border: 1px solid #c5d0de;
    padding: 6px 8px;
    vertical-align: top;
  }
  table.summary .sum-label {
    background: #F6F8FC;
    font-weight: 700;
    color: #082A59;
    text-align: center;
    vertical-align: middle;
    border-left: 3px solid #F26522;
  }
  table.summary .sum-value {
    text-align: right;
    font-weight: 700;
    white-space: nowrap;
    color: #F26522;
    font-variant-numeric: tabular-nums lining-nums;
    vertical-align: middle;
  }
  table.summary .sum-value:not(:empty) { background: #FFF200; color: #082A59; }
  table.summary .sum-value .amt,
  table.summary .sum-value .unit { color: #082A59; }
  table.summary .sum-note {
    color: #334155;
    white-space: pre-wrap;
    word-break: break-word;
    text-align: right;
    vertical-align: middle;
  }
  table.summary.deposit { margin-top: 10px; }
  table.summary.deposit td { padding: 4px 8px; }
  table.summary .dep-label {
    font-weight: 700;
    color: #082A59;
    text-align: left;
    vertical-align: middle;
  }
  table.summary .dep-value {
    text-align: right;
    font-weight: 700;
    color: #082A59;
    font-variant-numeric: tabular-nums lining-nums;
    vertical-align: middle;
  }

  .bank {
    margin-top: 12px;
    padding: 8px 10px 8px 12px;
    border: 1px solid #c5d0de;
    border-left: 4px solid #F26522;
    background: #F6F8FC;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .bank h2 {
    margin: 0 0 6px;
    font-size: 10pt;
    color: #082A59;
  }
  .bank div {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 4px 10px;
    margin: 2px 0;
    font-size: 9.5pt;
    color: #1e293b;
  }
  .bank span { color: #082A59; font-weight: 600; }

  .sign {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 18px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sign div {
    min-height: 96px;
    text-align: center;
    padding-top: 8px;
    border-top: 2px solid #082A59;
  }
  .sign p {
    margin: 0;
    font-weight: 700;
    color: #082A59;
  }
  .sign span {
    display: block;
    margin-top: 4px;
    color: #F26522;
    font-size: 9pt;
    font-weight: 600;
  }
`;

async function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  }));
}

/** In một hoặc nhiều mẫu báo giá (mỗi mẫu một trang A4 ngang). */
export async function printQuoteSheet(html: string | string[]): Promise<void> {
  const pages = (Array.isArray(html) ? html : [html]).filter(Boolean);
  if (pages.length === 0) return;
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "In báo giá");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  const body = pages
    .map((page, index) => `<div class="sheet-wrap${index < pages.length - 1 ? " page-break" : ""}">${page}</div>`)
    .join("");
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Báo giá</title><style>${quotePrintCss}
    .page-break { page-break-after: always; break-after: page; }
  </style></head><body>${body}</body></html>`);
  doc.close();
  await waitForImages(doc);
  win.focus();
  win.print();
  win.addEventListener("afterprint", () => frame.remove());
}

function safePdfFilename(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim();
  return cleaned || "bao-gia";
}

export type QuotePdfSource = QuoteCustomer & {
  code: string;
  orders: QuoteOrder[];
  notes: QuoteNotes;
  bank: QuoteBank;
};

export function orderForQuotePdf(orders: QuoteOrder[]): QuoteOrder | undefined {
  return orders.find((order) => order.selected) ?? orders[0];
}

function sheetHtmlForRecord(quote: QuotePdfSource): string {
  const order = orderForQuotePdf(quote.orders);
  if (!order) throw new Error("Chưa có mẫu báo giá để in");
  return quoteSheetHtml({
    customer: quote,
    lines: order.lines,
    currency: order.currency,
    rate: order.rate,
    notes: quote.notes,
    bank: quote.bank,
    code: quote.code,
    orderName: order.name,
  });
}

/** In báo giá từ bản ghi (ưu tiên mẫu đang chọn). */
export async function printQuoteRecord(quote: QuotePdfSource): Promise<void> {
  await printQuoteSheet(sheetHtmlForRecord(quote));
}

/** Tải PDF từ bản ghi báo giá (ưu tiên mẫu đang chọn). */
export async function downloadQuoteRecordPdf(quote: QuotePdfSource): Promise<void> {
  const order = orderForQuotePdf(quote.orders);
  if (!order) throw new Error("Chưa có mẫu báo giá để tải PDF");
  const filename = `${quote.code || "bao-gia"}${order.name ? `-${order.name}` : ""}`;
  await downloadQuotePdf(sheetHtmlForRecord(quote), filename);
}

/** Xuất PDF A4 ngang từ cùng HTML sheet dùng cho in. */
export async function downloadQuotePdf(html: string, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-12000px";
  host.style.top = "0";
  // Nội dung trong vùng A4 ngang trừ lề trái/phải ~12mm.
  host.style.width = `${1123 - 90}px`;
  host.style.background = "#fff";
  host.innerHTML = `<style>${quotePrintCss}</style><div class="sheet-wrap">${html}</div>`;
  document.body.appendChild(host);

  try {
    await waitForImages(host);
    const canvas = await html2canvas(host, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: host.scrollWidth,
      windowHeight: host.scrollHeight,
    });
    const image = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const sideMargin = 12;
    const contentWidth = pageWidth - sideMargin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(image, "JPEG", sideMargin, position, contentWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(image, "JPEG", sideMargin, position, contentWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${safePdfFilename(filename)}.pdf`);
  } finally {
    host.remove();
  }
}
