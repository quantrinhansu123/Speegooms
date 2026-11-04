import {
  formatQuoteNumber,
  quoteCompany,
  quoteCompanyLabels,
  quoteFileBase,
  quoteSheetInputOf,
  safeQuoteFilename,
  type QuoteLang,
  type QuoteLine,
  type QuoteSheetCustomer,
  type QuoteSheetInput,
  type QuoteSheetModel,
} from "@speego/shared";
import { SPEEGO_LOGO_DATA_URL } from "./quote-logo";
import { buildQuoteSheet, orderForQuotePdf, type QuotePdfSource } from "./quote-sheet";

export const companyName: string = quoteCompany.name;

/** Tiêu đề bên trái — thông tin bên phải (letterhead). Nhãn tiếng Việt, dùng cho preview cũ. */
export const companyFields: [string, string][] = quoteCompany.values.map((value, index) => [quoteCompanyLabels.vi[index] ?? "", value]);

/** @deprecated Dùng companyName + companyFields. Giữ để tương thích preview cũ. */
export const companyLines = [
  companyName,
  ...companyFields.map(([label, value]) => `${label}: ${value}`),
];

export type QuoteCustomer = QuoteSheetCustomer;

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

function imageSrc(value: string): string {
  if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  if (/^https:\/\/[^\s"]+$/.test(value)) return escapeHtml(value);
  return "";
}

function cell(value: string, className = ""): string {
  return `<td class="${className}">${value ? escapeHtml(value).replaceAll("\n", "<br>") : ""}</td>`;
}

/** Một dòng số + đơn vị (số thẳng số, đơn vị thẳng đơn vị). */
function numRow(amount: string, unit = ""): string {
  if (!amount && !unit) return "";
  return `<span class="num-row"><span class="amt">${escapeHtml(amount)}</span><span class="unit">${escapeHtml(unit)}</span></span>`;
}

/** Ô số: đơn vị trong header thì chỉ hiện số; có unit thì số + đơn vị thẳng cột. */
function numCell(amount: string, unit = "", className = "num"): string {
  if (!amount && !unit) return `<td class="${className}"></td>`;
  if (!unit) return `<td class="${className}"><span class="amt">${escapeHtml(amount)}</span></td>`;
  return `<td class="${className}">${numRow(amount, unit)}</td>`;
}

/** Ngày ISO yyyy-mm-dd thành dd/mm/yyyy; chuỗi khác giữ nguyên. */
function displayDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : value;
}

type Column = { key: string; width: number };

/** Các cột bảng hàng: tiền thêm chèn sau cột Tổng tiền hàng, diện tích trước CBM. */
function sheetColumns(model: QuoteSheetModel): Column[] {
  const cols: Column[] = [
    { key: "stt", width: 3.5 },
    { key: "image", width: 20 },
    { key: "qty", width: 6.5 },
    { key: "price", width: 9 },
    { key: "total", width: 11 },
  ];
  for (const code of model.extraCurrencies) {
    cols.push({ key: `price-${code}`, width: 8 }, { key: `total-${code}`, width: 10 });
  }
  if (model.showArea) cols.push({ key: "area", width: 6.5 });
  cols.push({ key: "cbm", width: 6.5 }, { key: "spec", width: 18 }, { key: "info", width: 16 });
  return cols;
}

/** Một colgroup dùng chung cho bảng hàng, tổng và đặt cọc để các cột luôn thẳng nhau. */
function colgroupHtml(cols: Column[]): string {
  const sum = cols.reduce((total, col) => total + col.width, 0);
  return `<colgroup>${cols.map((col) => `<col style="width:${((col.width / sum) * 100).toFixed(2)}%">`).join("")}</colgroup>`;
}

export function quoteSheetHtml(input: QuoteSheetInput & {
  logoUrl?: string;
  /** Chỉ thông tin khách hàng và bảng chi tiết đơn hàng, dùng cho màn hình theo dõi. */
  compact?: boolean;
}): string {
  const model = buildQuoteSheet(input);
  const { t, lang } = model;
  const fmt = (value: number | null, digits = 2) => (value == null ? "" : formatQuoteNumber(value, lang, digits));
  const logoUrl = input.logoUrl?.trim() || SPEEGO_LOGO_DATA_URL;
  const cols = sheetColumns(model);
  const colgroup = colgroupHtml(cols);
  const colCount = cols.length;

  const rows = model.lines.map((line) => {
    const images = line.images
      .map((item) => imageSrc(item))
      .filter(Boolean)
      .map((src) => `<img src="${src}" alt="">`)
      .join("");
    const extras = line.extra.map((item) => `${numCell(fmt(item.price), "")}${numCell(fmt(item.total), "", "num money")}`).join("");
    return `<tr>
      ${cell(line.stt, "stt")}
      <td class="image"><div class="image-stack">${images}</div></td>
      ${numCell(fmt(line.quantity), "")}
      ${numCell(fmt(line.price), line.priceUnit)}
      ${numCell(fmt(line.total), "", "num money")}
      ${extras}
      ${model.showArea ? numCell(fmt(line.area, 3), "") : ""}
      ${numCell(fmt(line.cbm, 3), "")}
      ${cell(line.spec, "wrap info")}
      ${cell(line.note, "wrap info")}
    </tr>`;
  }).join("");

  const metaRows: [string, string][] = [
    [t.quoteNo, model.meta.code],
    [t.issuedOn, displayDate(model.meta.issuedOn)],
    [t.orderName, model.meta.orderName],
  ];
  const customerTable = kvTableWide([...metaRows, ...model.customerRows], 3, [t.customer, "—"]);
  const companyTable = kvTableWide(model.company.rows, 2);

  /** Ô tổng theo loại tiền: tiền chính ở cột Tổng tiền hàng, tiền thêm ở cột riêng, tiền lạ kèm mã tiền. */
  const amountCells = (currency: string, amount: number) => {
    const text = fmt(amount);
    if (currency === model.currency) return { total: numRow(text), extra: {} };
    if (model.extraCurrencies.includes(currency)) return { total: "", extra: { [currency]: numRow(text) } };
    return { total: numRow(text, currency), extra: {} };
  };

  const summaryRow = (label: string, values: { total?: string; extra?: Record<string, string>; cbm?: string; area?: string }, note = "") => {
    const extraCells = model.extraCurrencies.map((code) => `<td class="sum-gap"></td><td class="sum-value">${values.extra?.[code] ?? ""}</td>`).join("");
    return `<tr>
      <td class="sum-label" colspan="4">${escapeHtml(label)}</td>
      <td class="sum-value">${values.total ?? ""}</td>
      ${extraCells}
      ${model.showArea ? `<td class="sum-value">${values.area ?? ""}</td>` : ""}
      <td class="sum-value">${values.cbm ?? ""}</td>
      <td class="sum-spec"></td>
      <td class="sum-note">${note ? escapeHtml(note).replaceAll("\n", "<br>") : ""}</td>
    </tr>`;
  };

  const cbmCell = model.totals.cbm > 0 ? numRow(fmt(model.totals.cbm, 3), "") : "";
  const areaCell = model.totals.area > 0 ? numRow(fmt(model.totals.area, 3), "") : "";

  const goodsRow = (model.totals.priced || model.weightNote)
    ? summaryRow(model.totalLabel, {
        total: model.totals.goods != null ? numRow(fmt(model.totals.goods), "") : "",
        extra: Object.fromEntries(model.extraCurrencies.map((code) => {
          const total = model.totals.extra[code];
          return [code, total != null ? numRow(fmt(total), "") : ""];
        })),
        cbm: cbmCell,
        area: areaCell,
      }, model.weightNote)
    : "";
  const feeRows = model.fees.map((fee) => {
    const cells = fee.amount != null ? amountCells(fee.currency, fee.amount) : { total: escapeHtml(fee.text), extra: {} };
    return summaryRow(fee.label || t.logisticsFee, cells);
  }).join("");
  const shippingRow = model.shippingText
    ? summaryRow(t.shippingTotal, { total: model.shippingAmount != null ? numRow(fmt(model.shippingAmount)) : escapeHtml(model.shippingText), cbm: cbmCell, area: areaCell }, model.validityNote)
    : "";
  const subtotalRows = model.feeSubtotals.length > 1 || (model.feeSubtotals.length === 1 && model.fees.length > 1)
    ? model.feeSubtotals.map((sub) => summaryRow(
        `${t.feeSubtotal} (${sub.currency})`,
        amountCells(sub.currency, sub.amount),
      )).join("")
    : "";
  const summaryRows = [goodsRow, feeRows, shippingRow, subtotalRows].filter(Boolean).join("");

  const blankAfterTotal = colCount - 5;
  const depositRows = model.deposit.map((line, index) => `<tr>
    <td class="dep-label" colspan="4">${escapeHtml(line)}</td>
    <td class="dep-value">${index === 0 && model.totals.goods != null ? numRow(fmt(model.totals.goods), "") : ""}</td>
    ${"<td></td>".repeat(Math.max(blankAfterTotal, 0))}
  </tr>`).join("");

  const bankRows = model.bank.rows.filter(([, value]) => value.trim());
  const bankBlock = bankRows.length > 0
    ? `<section class="bank">
        <h2>${escapeHtml(model.bank.title || t.paymentInfo)}</h2>
        ${bankRows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span>${escapeHtml(value)}</div>`).join("")}
      </section>`
    : "";

  return `<article class="sheet ${input.compact ? "sheet-compact" : ""}">
  ${input.compact ? "" : `
  <header class="masthead">
    <div class="brand">
      <img class="logo" src="${escapeHtml(logoUrl)}" alt="SpeeGo Logistics" width="168" height="50">
      <div class="company">
        <strong>${escapeHtml(model.company.name)}</strong>
        ${companyTable}
      </div>
    </div>
  </header>
  <div class="accent-bar" aria-hidden="true"></div>
  <h1 class="doc-title">${escapeHtml(t.title)}</h1>
  `}

  <section class="party party-wide">
    <h2>${escapeHtml(t.customerInfo)}</h2>
    ${customerTable}
  </section>

  <h2 class="banner">${escapeHtml(t.orderDetails)}</h2>

  <table class="items">
    ${colgroup}
    <thead>
      <tr>
        <th>${escapeHtml(t.stt)}</th>
        <th>${escapeHtml(t.image)}</th>
        <th>${escapeHtml(t.quantity)}<br><span class="th-sub">(${escapeHtml(t.defaultUnit)})</span></th>
        <th>${escapeHtml(t.unitPrice)}<br><span class="th-sub">(${escapeHtml(model.currency)})</span></th>
        <th>${escapeHtml(t.lineTotal)}<br><span class="th-sub">(${escapeHtml(model.currency)})</span></th>
        ${model.extraCurrencies.map((code) => `<th>${escapeHtml(t.unitPrice)}<br><span class="th-sub">(${escapeHtml(code)})</span></th><th>${escapeHtml(t.lineTotal)}<br><span class="th-sub">(${escapeHtml(code)})</span></th>`).join("")}
        ${model.showArea ? `<th>${escapeHtml(t.area)}</th>` : ""}
        <th>${escapeHtml(t.cbm)}</th>
        <th>${escapeHtml(t.spec)}</th>
        <th>${escapeHtml(t.note)}</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${colCount}" class="empty">${escapeHtml(t.empty)}</td></tr>`}
    </tbody>
  </table>

  ${summaryRows || depositRows ? `<section class="closing">
  ${summaryRows ? `<table class="summary">${colgroup}<tbody>${summaryRows}</tbody></table>` : ""}
  ${depositRows ? `<table class="summary deposit">${colgroup}<tbody>${depositRows}</tbody></table>` : ""}
  </section>` : ""}

  ${input.compact ? "" : `
  <section class="payment-signatures">
  ${bankBlock}
  <section class="sign">
    <div>
      <p>${escapeHtml(t.partyA)}</p>
      <span>${escapeHtml(t.signStamp)}</span>
    </div>
    <div>
      <p>${escapeHtml(t.partyB)}</p>
      <span>${escapeHtml(t.signStamp)}</span>
    </div>
  </section>
  </section>
  `}
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
    display: block;
    padding-bottom: 10px;
  }
  .accent-bar { display: none; }
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
    padding-left: 0;
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
    background: #fff;
    padding: 0;
    min-width: 0;
    margin: 0 0 8px;
  }
  .party-wide { width: 100%; }
  .party h2 {
    margin: 0 0 6px;
    padding-bottom: 0;
    color: #082A59;
    font-size: 9.5pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.2;
  }
  .party table.kv {
    border-collapse: collapse;
  }
  .party table.kv th,
  .party table.kv td {
    border: 1px solid #dbe3ee;
    padding: 5px 8px;
    background: #fff;
  }
  .party table.kv th {
    background: #f7f9fc;
    width: auto;
    white-space: nowrap;
  }
  .party table.kv-wide td:nth-child(even) {
    padding-right: 8px;
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
  }

  table.items {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9pt;
  }
  .c-stt { width: 3.5%; }
  .c-image { width: 24%; }
  .c-qty { width: 7%; }
  .c-price { width: 9%; }
  .c-total { width: 11%; }
  .c-cbm { width: 7%; }
  .c-spec { width: 20%; }
  .c-info { width: 18.5%; }
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
    line-height: 1.25;
  }
  table.items .th-sub {
    display: inline-block;
    font-size: 8pt;
    font-weight: 600;
    opacity: 0.92;
    letter-spacing: 0;
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
    vertical-align: middle;
  }
  table.items .image-stack {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    justify-items: center;
    align-items: center;
  }
  table.items .image-stack:has(> img:only-child) {
    grid-template-columns: 1fr;
  }
  table.items .image img {
    width: 100%;
    max-width: 100%;
    max-height: 88px;
    object-fit: contain;
  }
  table.items .image-stack:has(> img:only-child) img {
    max-height: 120px;
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

  /* Ngắt trang: lặp tiêu đề cột, không cắt giữa hàng, giữ khối tổng/đặt cọc đi cùng nhau. */
  table.items thead { display: table-header-group; }
  table.items tr,
  table.summary tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .closing {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  table.summary .sum-gap { border-right: 0; background: #fff; }
  .payment-signatures {
    display: flow-root;
    break-inside: avoid;
    page-break-inside: avoid;
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
    text-align: center;
    padding-top: 8px;
    border-top: 2px solid #082A59;
  }
  .sign p {
    margin: 0;
    font-weight: 700;
    color: #082A59;
  }
  .sign div::after {
    content: "";
    display: block;
    height: 28mm;
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
  await doc.fonts.ready;
  win.focus();
  win.print();
  win.addEventListener("afterprint", () => frame.remove());
}

function sheetHtmlForRecord(quote: QuotePdfSource, lang?: QuoteLang): string {
  const order = orderForQuotePdf(quote.orders);
  if (!order) throw new Error("Chưa có mẫu báo giá để in");
  return quoteSheetHtml(quoteSheetInputOf(quote, order, lang));
}

/** In báo giá từ bản ghi (ưu tiên mẫu đang chọn). */
export async function printQuoteRecord(quote: QuotePdfSource, lang?: QuoteLang): Promise<void> {
  await printQuoteSheet(sheetHtmlForRecord(quote, lang));
}

/** Tải PDF từ bản ghi báo giá (ưu tiên mẫu đang chọn). */
export async function downloadQuoteRecordPdf(quote: QuotePdfSource, lang?: QuoteLang): Promise<void> {
  const order = orderForQuotePdf(quote.orders);
  if (!order) throw new Error("Chưa có mẫu báo giá để tải PDF");
  await downloadQuotePdf(sheetHtmlForRecord(quote, lang), quoteFileBase(quote.code, order.name, lang));
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
  host.style.width = "273mm";
  host.style.background = "#fff";
  host.innerHTML = `<style>${quotePrintCss}</style><div class="sheet-wrap">${html}</div>`;
  document.body.appendChild(host);

  try {
    await waitForImages(host);
    await document.fonts.ready;
    const canvas = await html2canvas(host, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: host.scrollWidth,
      windowHeight: host.scrollHeight,
    });
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const sideMargin = 12;
    const contentWidth = pageWidth - sideMargin * 2;
    const topMargin = 10;
    const pixelsPerMm = canvas.width / contentWidth;
    const pagePixels = Math.floor((pageHeight - topMargin * 2) * pixelsPerMm);
    const hostTop = host.getBoundingClientRect().top;
    const scale = canvas.width / host.getBoundingClientRect().width;
    // Keep rows and the complete bank/signature block together where they fit a page.
    const protectedBlocks = Array.from(host.querySelectorAll("tr, .payment-signatures")).map((element) => {
      const rect = element.getBoundingClientRect();
      return { top: Math.floor((rect.top - hostTop) * scale), bottom: Math.ceil((rect.bottom - hostTop) * scale) };
    });
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    let start = 0;
    while (start < canvas.height) {
      let end = Math.min(start + pagePixels, canvas.height);
      // Moving a boundary may expose another crossing block (e.g. a nested bank row).
      let crossing;
      while ((crossing = protectedBlocks.find((block) => block.top > start && block.top < end && block.bottom > end && block.bottom - block.top <= pagePixels))) {
        end = crossing.top;
      }
      pageCanvas.height = end - start;
      const context = pageCanvas.getContext("2d");
      if (!context) throw new Error("Không thể tạo trang PDF");
      context.drawImage(canvas, 0, start, canvas.width, end - start, 0, 0, canvas.width, end - start);
      if (start > 0) pdf.addPage();
      pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.95), "JPEG", sideMargin, topMargin, contentWidth, (end - start) / pixelsPerMm);
      start = end;
    }

    pdf.save(`${safeQuoteFilename(filename)}.pdf`);
  } finally {
    host.remove();
  }
}
