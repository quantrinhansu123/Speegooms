import {
  formatQuoteNumber,
  fclChargeTotal,
  fclTotals,
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
    cbm: Math.round(lines.reduce((sum, line) => sum + (line.cbm ?? 0) * (line.quantity ?? 1), 0) * 1000) / 1000,
    goods: lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0),
    weight: lines.reduce((sum, line) => sum + (line.weightKg ?? 0) * (line.quantity ?? 1), 0),
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

/** Số cột cố định đứng trước cột Thành tiền chính: STT, Mặt hàng, Hình ảnh, Số lượng, Đơn giá. */
const COLUMNS_BEFORE_TOTAL = 5;

/** Các cột bảng hàng: tiền thêm (đơn giá + thành tiền) chèn sau cột Thành tiền chính. */
function sheetColumns(model: QuoteSheetModel): Column[] {
  const cols: Column[] = [
    { key: "stt", width: 3 },
    { key: "product", width: 15 },
    { key: "image", width: 16 },
    { key: "qty", width: 7 },
    ...(model.showPricing ? [{ key: "price", width: 9 }, { key: "total", width: 11 }] : []),
  ];
  for (const code of model.extraCurrencies) {
    cols.push({ key: `price-${code}`, width: 8 }, { key: `total-${code}`, width: 10 });
  }
  cols.push({ key: "spec", width: 16 }, { key: "info", width: 15 });
  return cols;
}

/** Một colgroup dùng chung cho bảng hàng, tổng và đặt cọc để các cột luôn thẳng nhau. */
function colgroupHtml(cols: Column[]): string {
  const sum = cols.reduce((total, col) => total + col.width, 0);
  return `<colgroup>${cols.map((col) => `<col style="width:${((col.width / sum) * 100).toFixed(2)}%">`).join("")}</colgroup>`;
}

/** Tài khoản nhận tiền cố định của Speego, in ở cuối phiếu báo giá. */
function bankInfoBlock(lang: QuoteLang, model?: QuoteSheetModel): string {
  if (model?.payment) {
    const rows = [...model.payment.rows, ...model.bank.rows].filter(([, value]) => value.trim());
    return `<section class="bank"><h2>${escapeHtml(model.t.paymentInfo)}</h2>${model.payment.error ? `<p>${escapeHtml(model.payment.error)}</p>` : ""}${rows.map(([label, value]) => `<div class="r"><span>${escapeHtml(label)}</span>${escapeHtml(value)}</div>`).join("")}</section>`;
  }
  const vi = lang === "vi";
  const rowsHtml = (rows: [string, string][]) => rows.map(([label, value]) => `<div class="r"><span>${label}</span>${escapeHtml(value)}</div>`).join("");
  const group = (title: string, rows: [string, string][]) => `<h3>${title}</h3>${rowsHtml(rows)}`;
  const company: [string, string][] = [
    [vi ? "Tên công ty" : "Company", "SPEEGO LOGISTICS CORPORATION"],
    [vi ? "Địa chỉ" : "Address", "7303 Breen Dr, Suite D2, Houston, TX 77086, US."],
    [vi ? "Ngân hàng" : "Bank", "REGIONS BANK"],
    [vi ? "Địa chỉ ngân hàng" : "Bank address", vi ? "2730 Gessner Rd, Houston, TX 77080, Hoa Kỳ." : "2730 Gessner Rd, Houston, TX 77080, USA."],
  ];
  const wire = group(vi ? "CHUYỂN TIỀN NGÂN HÀNG WIRE TRANSFER" : "WIRE TRANSFER", [
    [vi ? "Tên chủ tài khoản" : "Account name", "SPEEGO LOGISTICS CORPORATION"],
    [vi ? "Số tài khoản" : "Account number", "0379414656"],
    ["Routing Number", "062005690"],
    [vi ? "Mã SWIFT" : "SWIFT code", "UPNBUS44"],
  ]);
  const ach = group(vi ? "CHUYỂN TIỀN ACH (ACH TRANSFER)" : "ACH TRANSFER", [
    [vi ? "Tài khoản" : "Account", "SPEEGO LOGISTICS CORPORATION"],
    [vi ? "Số tài khoản" : "Account number", "0379414656"],
    ["Routing Number", "111900785"],
  ]);
  return `<section class="bank">
    <h2>${vi ? "TÀI KHOẢN NGÂN HÀNG" : "BANK INFORMATION"}</h2>
    <div class="bank-cols"><div>${rowsHtml(company)}${ach}</div><div>${wire}</div></div>
  </section>`;
}

function quoteItemsHtml(model: QuoteSheetModel): string {
  if (!model.showPricing) return "";
  const { t, lang } = model;
  const fmt = (value: number | null, digits = 2) => value == null ? "" : formatQuoteNumber(value, lang, digits);
  const cols = sheetColumns(model);
  const colgroup = colgroupHtml(cols);
  const colCount = cols.length;
  const rows = model.lines.map((line) => {
    const images = line.images
      .map((item) => imageSrc(item))
      .filter(Boolean)
      .map((src) => `<img src="${src}" alt="">`)
      .join("");
    const extras = line.extra.map((item) => `${numCell(fmt(item.price, 3), "")}${numCell(fmt(item.total, 3), "", "num money")}`).join("");
    return `<tr>
      ${cell(line.stt, "stt")}
      ${cell(line.productName, "wrap info")}
      <td class="image"><div class="image-stack">${images}</div></td>
      ${numCell(fmt(line.quantity), "")}
      ${model.showPricing ? `${numCell(fmt(line.price, 3), line.priceUnit)}${numCell(fmt(line.total, 3), "", "num money")}` : ""}
      ${extras}
      ${cell(line.spec, "wrap info")}
      ${cell(line.note, "wrap info")}
    </tr>`;
  }).join("");

  return `  <h2 class="banner">${escapeHtml(t.orderDetails)}</h2>

  <table class="items">
    ${colgroup}
    <thead>
      <tr>
        <th>${escapeHtml(t.stt)}</th>
        <th>${escapeHtml(t.product)}</th>
        <th>${escapeHtml(t.image)}</th>
        <th>${escapeHtml(model.quantityUnit ? `${t.quantity} (${model.quantityUnit})` : t.quantity)}</th>
        ${model.showPricing ? `<th>${escapeHtml(t.unitPrice)}<br><span class="th-sub">(${escapeHtml(model.currency)})</span></th><th>${escapeHtml(t.lineTotal)}<br><span class="th-sub">(${escapeHtml(model.currency)})</span></th>` : ""}
        ${model.extraCurrencies.map((code) => `<th>${escapeHtml(t.unitPrice)}<br><span class="th-sub">(${escapeHtml(code)})</span></th><th>${escapeHtml(t.lineTotal)}<br><span class="th-sub">(${escapeHtml(code)})</span></th>`).join("")}
        <th>${escapeHtml(t.spec)}</th>
        <th>${escapeHtml(t.note)}</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${colCount}" class="empty">${escapeHtml(t.empty)}</td></tr>`}
    </tbody>
  </table>
`;
}

export function quoteSheetHtml(input: QuoteSheetInput & {
  logoUrl?: string;
  /** Chỉ thông tin khách hàng và bảng chi tiết đơn hàng, dùng cho màn hình theo dõi. */
  compact?: boolean;
}): string {
  if (input.shippingMode === "SEA" && input.logisticsClass === "FCL" && input.notes.fcl) {
    return fclSheetHtml(input);
  }
  const model = buildQuoteSheet(input);
  const { t, lang } = model;
  const fmt = (value: number | null, digits = 2) => (value == null ? "" : formatQuoteNumber(value, lang, digits));
  const logoUrl = input.logoUrl?.trim() || SPEEGO_LOGO_DATA_URL;
  const cols = sheetColumns(model);
  const colgroup = colgroupHtml(cols);
  const colCount = cols.length;

  const metaRows: [string, string][] = [
    [t.quoteNo, model.meta.code],
    [t.issuedOn, displayDate(model.meta.issuedOn)],
    [t.orderName, model.meta.orderName],
  ];
  const customerTable = kvTableWide([...metaRows, ...model.customerRows], 3, [t.customer, "—"]);
  const companyTable = kvTableWide(model.company.rows, 2);


  /** Dòng tổng: nhãn | trống (đơn giá) | thành tiền | tiền thêm | quy cách | note. */
  const summaryRow = (label: string, values: { total?: string; extra?: Record<string, string> }, note = "") => {
    if (!model.showPricing && values.total) return `<tr><td class="sum-label" colspan="${colCount - 1}">${escapeHtml(label)}</td><td class="sum-value">${values.total}</td></tr>`;
    const extraCells = model.extraCurrencies.map((code) => `<td class="sum-gap"></td><td class="sum-value">${values.extra?.[code] ?? ""}</td>`).join("");
    return `<tr>
      <td class="sum-label" colspan="4">${escapeHtml(label)}</td>
      ${model.showPricing ? `<td></td><td class="sum-value">${values.total ?? ""}</td>` : ""}
      ${extraCells}
      <td class="sum-spec"></td>
      <td class="sum-note">${note ? escapeHtml(note).replaceAll("\n", "<br>") : ""}</td>
    </tr>`;
  };

  const goodsRow = (model.totals.priced || model.weightNote)
    ? summaryRow(model.totalLabel, {
        total: model.totals.goods != null ? numRow(fmt(model.totals.goods), "") : "",
        extra: Object.fromEntries(model.extraCurrencies.map((code) => {
          const total = model.totals.extra[code];
          return [code, total != null ? numRow(fmt(total), "") : ""];
        })),
      }, model.weightNote)
    : "";
  const freightTotal = model.freight.total;
  const shippingDuplicatesFreight = model.shippingAmount != null && freightTotal != null && model.shippingAmount === freightTotal;
  const shippingRow = model.shippingText && model.feeSubtotals.length === 0 && !shippingDuplicatesFreight
    ? summaryRow(t.shippingTotal, { total: model.shippingAmount != null ? numRow(fmt(model.shippingAmount), model.currency) : escapeHtml(model.shippingText) }, model.validityNote)
    : "";
  const summaryRows = [goodsRow, shippingRow].filter(Boolean).join("");
  const freightCell = (amount: string, unit = "", total = false) => `<td${total ? ' class="freight-total"' : ""}>${amount || unit ? numRow(amount, unit) : ""}</td>`;
  const usesKg = model.freight.basis === "kg" || model.freight.basis === "both";
  const usesCbm = model.freight.basis === "cbm" || model.freight.basis === "both";
  const freightColumns: { head: string; cell: string }[] = [
    ...(model.freight.basis === "lump" ? [] : [{
      head: t.freightRate,
      cell: freightCell([
        usesKg && model.freight.rate != null ? `${fmt(model.freight.rate, 3)} ${model.freight.currency}/kg` : "",
        usesCbm && model.freight.cbmRate != null ? `${fmt(model.freight.cbmRate, 3)} ${model.freight.currency}/CBM` : "",
      ].filter(Boolean).join(" + ")),
    }]),
    ...(usesKg ? [{ head: t.chargeableWeight, cell: freightCell(model.freight.chargeableKg == null ? "" : fmt(model.freight.chargeableKg, 1), model.freight.chargeableKg == null ? "" : "kg") }] : []),
    ...(usesCbm ? [{ head: t.chargeableVolume, cell: freightCell(model.freight.chargeableCbm == null ? "" : fmt(model.freight.chargeableCbm, 3), model.freight.chargeableCbm == null ? "" : "CBM") }] : []),
    { head: t.freightTotal, cell: freightCell(model.freight.total == null ? "" : fmt(model.freight.total, 3), model.freight.total == null ? "" : model.freight.currency, true) },
  ];
  /**
   * Phụ phí vận chuyển in trong phần Chi phí vận chuyển, cùng bảng cước: tên phí trải các cột đầu,
   * số tiền nằm đúng cột Tổng chi phí để cân với tiền cước. Cước trọn gói chỉ có một cột thì tên và số tiền chung ô.
   */
  const feeAmount = (fee: QuoteSheetModel["fees"][number]) => (fee.amount != null ? numRow(fmt(fee.amount, 3), fee.currency) : escapeHtml(fee.text));
  const feeRows = model.fees.map((fee) => {
    const label = escapeHtml(fee.label || t.logisticsFee);
    return freightColumns.length > 1
      ? `<tr class="fee-row"><td class="fee-label" colspan="${freightColumns.length - 1}">${label}</td><td class="fee-value">${feeAmount(fee)}</td></tr>`
      : `<tr class="fee-row"><td class="fee-value"><span class="fee-label-inline">${label}</span> ${feeAmount(fee)}</td></tr>`;
  }).join("");
  /** Tổng chi phí logistics theo loại tiền: nhãn trải các cột đầu, số tiền đúng cột Tổng chi phí; chỉ ô số tiền tô vàng. */
  const subtotalRows = model.feeSubtotals.map((sub) => {
    const label = escapeHtml(`${t.feeSubtotal} (${sub.currency})`);
    const amount = numRow(fmt(sub.amount), sub.currency);
    return freightColumns.length > 1
      ? `<tr class="sum-row"><td class="sum-row-label" colspan="${freightColumns.length - 1}">${label}</td><td class="sum-row-value">${amount}</td></tr>`
      : `<tr class="sum-row"><td class="sum-row-value"><span class="fee-label-inline">${label}</span> ${amount}</td></tr>`;
  }).join("");
  /** Lưu ý đã chọn, in dưới dòng Tổng chi phí logistics. */
  const freightNotes = model.freight.notes.length > 0
    ? `<div class="freight-note"><strong>${escapeHtml(model.freight.noteTitle)}:</strong><ul>${model.freight.notes.map((note) => `<li>${escapeHtml(note).replaceAll("\n", "<br>")}</li>`).join("")}</ul></div>`
    : "";
  const freightTable = `<section class="freight">
    <h2>${escapeHtml(t.freightTitle)}</h2>
    <table class="freight-table">
      <thead><tr>${freightColumns.map((column) => `<th>${escapeHtml(column.head)}</th>`).join("")}</tr></thead>
      <tbody><tr>${freightColumns.map((column) => column.cell).join("")}</tr>${feeRows}${subtotalRows}</tbody>
    </table>
    ${freightNotes}
  </section>`;

  const blankAfterTotal = model.showPricing ? colCount - COLUMNS_BEFORE_TOTAL - 1 : colCount - 4;
  const depositRows = model.deposit.map((line, index) => `<tr>
    <td class="dep-label" colspan="4">${escapeHtml(line)}</td>
    ${model.showPricing ? `<td></td><td class="dep-value">${index === 0 && model.totals.goods != null ? numRow(fmt(model.totals.goods), "") : ""}</td>` : ""}
    ${"<td></td>".repeat(Math.max(blankAfterTotal, 0))}
  </tr>`).join("");

  const bankBlock = bankInfoBlock(lang, model);

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

  ${quoteItemsHtml(model)}

  ${summaryRows || depositRows ? `<section class="closing">
  ${summaryRows ? `<table class="summary">${colgroup}<tbody>${summaryRows}</tbody></table>` : ""}
  ${depositRows ? `<table class="summary deposit">${colgroup}<tbody>${depositRows}</tbody></table>` : ""}
  </section>` : ""}
  ${freightTable}

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

function fclSheetHtml(input: QuoteSheetInput): string {
  const fcl = input.notes.fcl!;
  const currency = escapeHtml(input.notes.payment?.quoteCurrency ?? "USD");
  const model = buildQuoteSheet(input);
  const fields = [
    ["To", fcl.to || input.customer.companyName || input.customer.customerName || ""],
    ["POL", fcl.pol], ["POD", fcl.pod], ["ETD", fcl.etd],
    ["Weight", fcl.weight], ["Volume", fcl.volume],
    ["Commodity", fcl.commodity], ["Date of stuffing goods", fcl.stuffingDate],
  ];
  const fmt = (value: number | null) => value == null ? "" : formatQuoteNumber(value, input.lang ?? "vi", 2);
  const cell = (value: string | number) => `<td>${escapeHtml(String(value))}</td>`;
  const totals = fclTotals(fcl.charges);
  return `<article class="sheet fcl-sheet">
    <header class="masthead"><div class="brand"><img class="logo" src="${SPEEGO_LOGO_DATA_URL}" alt="SpeeGo Logistics" width="168" height="50"><div class="company"><strong>${escapeHtml(quoteCompany.name)}</strong><p>${escapeHtml(quoteCompany.values.join(" · "))}</p></div></div></header>
    <div class="accent-bar" aria-hidden="true"></div>
    <h1 class="doc-title">QUOTATION ${escapeHtml(input.code ?? "")}</h1>
    <h2 class="banner">SHIPMENT INFORMATION</h2>
    <table class="items"><tbody>${fields.map(([label, value]) => `<tr><th style="text-align:left;width:30%">${escapeHtml(label)}</th>${cell(value)}</tr>`).join("")}</tbody></table>
    ${model.lines.length > 0 ? quoteItemsHtml(model) : ""}
    <h2 class="banner">QUOTATION · ${currency}</h2>
    <table class="items"><thead><tr><th>OR.</th><th>NAME</th><th>UNIT RATE</th><th>QUANTITY</th><th>UNIT</th><th>VAT 8% (${currency})</th><th>TOTAL</th><th>NOTE</th></tr></thead>
    <tbody>${fcl.charges.map((row, index) => `<tr>${cell(index + 1)}${cell(row.name)}${cell(fmt(row.rate))}${cell(row.quantity ?? "")}${cell(row.unit)}${cell(fmt(row.vatAmount))}${cell(fmt(fclChargeTotal(row)))}${cell(row.note)}</tr>`).join("")}</tbody></table>
    <table class="items"><tbody><tr><th style="text-align:left" colspan="7">TOTAL IN ${currency} WITHOUT OPTIONAL CHARGES</th>${cell(fmt(totals.base))}</tr><tr><th style="text-align:left" colspan="7">TOTAL IN ${currency} WITH ALL CHARGES</th>${cell(fmt(totals.all))}</tr></tbody></table>
    ${fcl.notes ? `<p style="white-space:pre-wrap;padding:12px">${escapeHtml(fcl.notes)}</p>` : ""}
    ${model.payment ? bankInfoBlock(input.lang ?? "vi", model) : ""}
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
  .freight { margin-top: 10px; }
  .freight h2 {
    margin: 0 0 4px;
    color: #082A59;
    font-size: 11pt;
    font-weight: 700;
  }
  table.freight-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9.5pt;
  }
  table.freight-table th,
  table.freight-table td {
    border: 1px solid #c5d0de;
    padding: 6px 8px;
    text-align: center;
    vertical-align: middle;
  }
  table.freight-table th {
    background: #082A59;
    color: #fff;
    font-weight: 700;
  }
  table.freight-table td:not(:empty) {
    color: #082A59;
    font-weight: 700;
  }
  table.freight-table .amt,
  table.freight-table .unit { color: #082A59; }
  table.freight-table tr.fee-row td.fee-label {
    background: #EEF3FA;
    color: #082A59;
    font-weight: 700;
    text-align: left;
  }
  table.freight-table tr.fee-row .fee-label-inline,
  table.freight-table tr.sum-row .fee-label-inline { float: left; }
  /* Dòng Tổng chi phí logistics: chỉ ô số tiền tô vàng. */
  table.freight-table tr.sum-row td.sum-row-label {
    background: #fff;
    color: #082A59;
    font-weight: 700;
    text-align: left;
  }
  table.freight-table tr.sum-row td.sum-row-value {
    background: #FFF200;
    color: #082A59;
    font-weight: 700;
  }
  .freight-note {
    break-inside: avoid;
    page-break-inside: avoid;
    margin: 6px 0 0;
    color: #334155;
    font-size: 9pt;
    font-style: italic;
  }
  .freight-note ul {
    margin: 2px 0 0;
    padding-left: 18px;
  }
  .freight-note li { margin: 1px 0; }

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

  /* Ngắt trang: lặp tiêu đề cột, giữ khối tổng/đặt cọc đi cùng nhau. */
  table.items thead { display: table-header-group; }
  /* Hàng hàng hóa cao (nhiều ảnh, quy cách dài) được phép tách trang để không chừa khoảng trống lớn. */
  table.summary tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  table.items img { break-inside: avoid; page-break-inside: avoid; }
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
  .bank-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
  .bank-cols h3:first-child { margin-top: 0; }
  .bank .r {
    display: grid;
    grid-template-columns: 105px 1fr;
    gap: 4px 10px;
    margin: 2px 0;
    font-size: 9.5pt;
    color: #1e293b;
  }
  .bank span { color: #082A59; font-weight: 600; }
  .bank h3 { margin: 8px 0 2px; font-size: 9.5pt; color: #082A59; }

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

/** CSS khung thead/tfoot — dùng chung in thật và preview/screenshot. */
export const quotePrintFrameCss = `
  @page { margin: 0; }
  body { margin: 0; padding: 0 12mm; background: #fff; }
  table.frame { width: 100%; border-collapse: collapse; }
  table.frame > thead > tr > td, table.frame > tbody > tr > td, table.frame > tfoot > tr > td { padding: 0; }
  .frame-head { padding-top: 8mm !important; padding-bottom: 4mm !important; }
  .frame-foot { padding-top: 3mm !important; padding-bottom: 8mm !important; border-top: 1px solid #cbd5e1; }
  .frame-foot .print-foot { color: #082A59; font-size: 8pt; line-height: 1.35; }
  .page-break { page-break-after: always; break-after: page; }
`;

export function quotePrintFootHtml(): string {
  return `<div class="print-foot"><strong>${escapeHtml(quoteCompany.name)}</strong> · ${escapeHtml(quoteCompany.values.filter(Boolean).slice(0, 2).join(" · "))}</div>`;
}

function quotePrintPages(html: string | string[]): string[] {
  return (Array.isArray(html) ? html : [html]).filter(Boolean);
}

/** Bọc mỗi sheet trong table.frame (thead/tfoot để đầu/cuối lặp khi in). */
export function quotePrintFramesHtml(pages: string[]): string {
  return pages
    .map((page, index) => `<table class="frame${index < pages.length - 1 ? " page-break" : ""}"><thead><tr><td class="frame-head"></td></tr></thead><tbody><tr><td><div class="sheet-wrap">${page}</div></td></tr></tbody><tfoot><tr><td class="frame-foot"></td></tr></tfoot></table>`)
    .join("");
}

/** Gắn masthead → thead, chân công ty → tfoot. */
export function mountQuotePrintFrames(doc: Document, footHtml = quotePrintFootHtml()): void {
  doc.querySelectorAll("table.frame").forEach((table) => {
    const headCell = table.querySelector(".frame-head");
    const footCell = table.querySelector(".frame-foot");
    const masthead = table.querySelector(".masthead");
    if (headCell && masthead) {
      headCell.appendChild(masthead.cloneNode(true));
      masthead.remove();
    } else if (headCell) {
      headCell.innerHTML = `<div style="height:8mm"></div>`;
    }
    if (footCell) footCell.innerHTML = footHtml;
  });
}

/** Document HTML sẵn sàng chụp/preview offline (cùng khung với bản in). */
export function quotePrintPreviewDocument(sheetHtml: string | string[]): string {
  const pages = quotePrintPages(sheetHtml);
  const foot = quotePrintFootHtml();
  return `<!doctype html><html><head><meta charset="utf-8"><style>${quotePrintCss}${quotePrintFrameCss}</style></head><body>
    ${quotePrintFramesHtml(pages)}
    <script>
      (function (footHtml) {
        document.querySelectorAll("table.frame").forEach(function (table) {
          var headCell = table.querySelector(".frame-head");
          var footCell = table.querySelector(".frame-foot");
          var masthead = table.querySelector(".masthead");
          if (headCell && masthead) {
            headCell.appendChild(masthead.cloneNode(true));
            masthead.remove();
          } else if (headCell) {
            headCell.innerHTML = '<div style="height:8mm"></div>';
          }
          if (footCell) footCell.innerHTML = footHtml;
        });
      })(${JSON.stringify(foot)});
    </script>
  </body></html>`;
}

/** In một hoặc nhiều mẫu báo giá (mỗi mẫu một trang A4 ngang). */
export async function printQuoteSheet(html: string | string[]): Promise<void> {
  const pages = quotePrintPages(html);
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
  // @page margin 0: đầu/cuối cố định lặp theo trang qua thead/tfoot (logo + chân công ty).
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Báo giá</title><style>${quotePrintCss}${quotePrintFrameCss}</style></head><body>${quotePrintFramesHtml(pages)}</body></html>`);
  doc.close();
  mountQuotePrintFrames(doc);
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
    // Keep masthead, rows, totals, freight notes and bank/signatures together where they fit a page.
    const protectedBlocks = Array.from(host.querySelectorAll(".masthead, tr, .closing, .freight-note, .payment-signatures")).map((element) => {
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
