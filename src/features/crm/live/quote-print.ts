import { packagesText } from "@/services/crm/quote-lines";
import type { QuoteBank, QuoteCurrency, QuoteLine, QuoteNotes, QuoteOrder } from "@speego/shared";
import { SPEEGO_LOGO_DATA_URL } from "./quote-logo";

export const companyLines = [
  "CÔNG TY TNHH SPEEGO LOGISTICS",
  "Hà Nội: Tầng 24, Leadvisors Tower, 643 Phạm Văn Đồng, Phường Nghĩa Đô, HN",
  "HCM: 01 Đường số 4, KDC Cityland Park Hills, phường Gò Vấp, HCM",
  "Mỹ: 7303 Breen Dr, Houston, TX 77086, US",
  "SĐT: 079.673.8695",
  "Gmail: sales@speegologistic.com",
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
    || line.image
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

function moneyWithCurrency(value: number, currency: QuoteCurrency): string {
  return `${formatAmount(value)} ${currency}`;
}

/** Dòng tổng kết dưới bảng hàng: nhãn | số liệu | ghi chú — không nhét vào cột STT. */
function summaryRow(label: string, value = "", note = ""): string {
  return `<tr>
    <td class="sum-label">${escapeHtml(label)}</td>
    <td class="sum-value">${value ? escapeHtml(value).replaceAll("\n", "<br>") : ""}</td>
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
    const src = imageSrc(line.image);
    const image = src ? `<img src="${src}" alt="">` : "";
    const measure = line.cbm != null && line.cbm > 0
      ? `${formatAmount(line.cbm, 3)} CBM`
      : line.weightKg != null
        ? `${formatAmount(line.weightKg)} KG`
        : "";
    const qty = line.quantity == null
      ? ""
      : `${formatAmount(line.quantity)}${line.unit && line.unit !== "set" ? ` ${line.unit}` : ""}`;
    const price = line.pricePerSet == null
      ? ""
      : `${formatAmount(line.pricePerSet)}${line.basis === "unit" ? "" : ` /${{ kg: "kg", cbm: "cbm", lump: "trọn gói" }[line.basis]}`}`;
    return `<tr>
      ${cell(line.stt, "stt")}
      <td class="image">${image}</td>
      ${cell(qty, "num")}
      ${cell(price, "num")}
      ${cell(line.lineTotal == null ? "" : moneyWithCurrency(line.lineTotal, currency), "num money")}
      ${cell(measure, "num")}
      ${cell(line.spec, "wrap")}
      ${cell(lineNote(line), "wrap")}
    </tr>`;
  }).join("");

  const hasText = (value: string | null | undefined) => Boolean(value?.trim());
  const info = [
    ["Khách hàng", input.customer.customerName ?? ""],
    ["Công ty", input.customer.companyName ?? ""],
    ["Địa chỉ", input.customer.address ?? ""],
    ["SĐT", input.customer.phone ?? ""],
    ["Email", input.customer.email ?? ""],
  ]
    .filter(([, value]) => hasText(value))
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");

  const totalLabel = input.notes.totalLabel?.trim() || "Tổng giá trị hàng hóa chưa bao gồm phí vận chuyển";
  const shippingLabel = input.notes.shippingLabel?.trim() ?? "";
  const weightNote = input.notes.weightNote?.trim() ?? "";
  const validityNote = input.notes.validityNote?.trim() ?? "";
  const depositLines = input.notes.deposit.map((line) => line.trim()).filter(Boolean);
  const measureTotal = totals.cbm > 0
    ? `${formatAmount(totals.cbm, 3)} CBM`
    : totals.weighed
      ? `${formatAmount(totals.weight)} KG`
      : "";

  const summaryRows = [
    (totals.priced || hasText(input.notes.totalLabel) || weightNote)
      ? summaryRow(
          totalLabel,
          totals.priced ? moneyWithCurrency(totals.goods, currency) : "",
          [measureTotal, weightNote].filter(Boolean).join(" · "),
        )
      : "",
    shippingLabel
      ? summaryRow(shippingLabel, measureTotal, validityNote)
      : validityNote
        ? summaryRow("Hiệu lực báo giá", "", validityNote)
        : "",
    totals.packageCount > 0
      ? summaryRow(
          "Tổng đóng gói",
          "",
          `${totals.packageCount} kiện = ${formatAmount(totals.cbm, 3)} CBM, cân tính cước ${formatAmount(totals.weight)} KG`,
        )
      : "",
    converted != null
      ? summaryRow(
          `Quy đổi (1 ${currency} = ${formatAmount(input.rate ?? 0)} VND)`,
          `${formatAmount(converted)} VND`,
        )
      : "",
    ...depositLines.map((line, index) => summaryRow(
      line,
      index === 0 && totals.priced ? moneyWithCurrency(totals.goods, currency) : "",
    )),
  ].filter(Boolean).join("");

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
        <strong>${escapeHtml(companyLines[0] ?? "")}</strong>
        ${companyLines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </div>
    </div>
    <div class="meta">
      ${code ? `<p><span>Mã</span>${escapeHtml(code)}</p>` : ""}
      ${orderName ? `<p><span>Mẫu</span>${escapeHtml(orderName)}</p>` : ""}
      <p><span>Ngày</span>${escapeHtml(issuedOn)}</p>
    </div>
  </header>
  <div class="accent-bar" aria-hidden="true"></div>
  <h1 class="doc-title">BÁO GIÁ</h1>

  <h2 class="banner">THÔNG TIN ĐƠN HÀNG</h2>

  ${info ? `<table class="info">${info}</table>` : ""}

  <table class="items">
    <colgroup>
      <col class="c-stt"><col class="c-image"><col class="c-qty"><col class="c-price">
      <col class="c-total"><col class="c-measure"><col class="c-spec"><col class="c-note">
    </colgroup>
    <thead>
      <tr>
        <th>STT</th>
        <th>Hình ảnh</th>
        <th>Số lượng</th>
        <th>Đơn giá (${escapeHtml(currency)})</th>
        <th>Tổng tiền hàng (${escapeHtml(currency)})</th>
        <th>Cân nặng / CBM</th>
        <th>Thông số</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="8" class="empty">Chưa có dòng hàng</td></tr>`}
    </tbody>
  </table>

  ${summaryRows ? `<table class="summary"><tbody>${summaryRows}</tbody></table>` : ""}

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
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 10px;
    border-bottom: 3px solid #082A59;
  }
  .accent-bar {
    height: 4px;
    background: #F26522;
  }
  .brand {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
    flex: 1 1 auto;
    max-width: 58%;
  }
  .logo {
    width: 168px;
    height: auto;
    max-height: 58px;
    object-fit: contain;
    object-position: left center;
    flex-shrink: 0;
  }
  .company {
    min-width: 0;
    max-width: 320px;
    border-left: 2px solid #F26522;
    padding-left: 10px;
  }
  .company strong {
    display: block;
    color: #082A59;
    font-size: 10pt;
    letter-spacing: 0.02em;
    margin-bottom: 3px;
  }
  .company p { margin: 0; font-size: 8pt; color: #334155; line-height: 1.3; }
  .meta {
    flex: 0 0 210px;
    text-align: right;
    font-size: 9pt;
    color: #082A59;
  }
  .meta p { margin: 2px 0; }
  .meta span {
    display: inline-block;
    min-width: 42px;
    margin-right: 6px;
    color: #64748b;
    font-weight: 600;
    text-align: left;
  }

  .doc-title {
    margin: 14px 0 10px;
    padding: 0;
    color: #082A59;
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-align: center;
    line-height: 1.2;
  }

  .banner {
    margin: 0 0 8px;
    padding: 7px 10px;
    background: #082A59;
    color: #fff;
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-align: center;
    border-left: 6px solid #F26522;
  }

  table.info {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
    font-size: 9.5pt;
  }
  table.info th {
    width: 110px;
    padding: 3px 8px 3px 0;
    text-align: left;
    vertical-align: top;
    color: #082A59;
    font-weight: 700;
    white-space: nowrap;
  }
  table.info td { padding: 3px 0; vertical-align: top; color: #1e293b; }

  table.items {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9pt;
  }
  .c-stt { width: 3.5%; }
  .c-image { width: 11%; }
  .c-qty { width: 7%; }
  .c-price { width: 10%; }
  .c-total { width: 11%; }
  .c-measure { width: 10%; }
  .c-spec { width: 20%; }
  .c-note { width: 27.5%; }
  table.items th,
  table.items td {
    border: 1px solid #c5d0de;
    padding: 5px 6px;
    vertical-align: middle;
  }
  table.items thead th {
    background: #082A59;
    color: #fff;
    font-weight: 700;
    text-align: center;
    border-color: #082A59;
    border-bottom: 3px solid #F26522;
  }
  table.items .stt { text-align: center; font-weight: 700; color: #082A59; }
  table.items .num { text-align: right; white-space: nowrap; color: #082A59; }
  table.items .money { font-weight: 700; color: #F26522; }
  table.items .image { text-align: center; padding: 6px 4px; width: 11%; }
  table.items .image img {
    width: 96px;
    max-width: 96px;
    max-height: 96px;
    object-fit: contain;
  }
  table.items .wrap { white-space: pre-wrap; text-align: left; word-break: break-word; color: #1e293b; }
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
    width: 42%;
    background: #F6F8FC;
    font-weight: 700;
    color: #082A59;
    border-left: 3px solid #F26522;
  }
  table.summary .sum-value {
    width: 22%;
    text-align: right;
    font-weight: 700;
    white-space: nowrap;
    color: #F26522;
  }
  table.summary .sum-note {
    width: 36%;
    color: #334155;
    white-space: pre-wrap;
    word-break: break-word;
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
