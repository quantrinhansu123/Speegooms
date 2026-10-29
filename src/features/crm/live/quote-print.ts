import type { QuoteBank, QuoteLine, QuoteNotes } from "@speego/shared";

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
  return {
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

function formatAmount(value: number | null): string {
  if (value == null) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function imageSrc(value: string): string {
  if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  if (/^https:\/\/[^\s"]+$/.test(value)) return escapeHtml(value);
  return "";
}

function cell(value: string, className = ""): string {
  return `<td class="${className}">${value ? escapeHtml(value).replaceAll("\n", "<br>") : ""}</td>`;
}

export function quoteSheetHtml(input: {
  customer: QuoteCustomer;
  lines: QuoteLine[];
  notes: QuoteNotes;
  bank: QuoteBank;
  logoUrl: string;
}): string {
  const totals = quoteTotals(input.lines);
  const rows = input.lines.map((line) => {
    const src = imageSrc(line.image);
    const image = src ? `<img src="${src}" alt="">` : "";
    return `<tr>
      ${cell(line.stt, "stt")}
      <td class="image">${image}</td>
      ${cell(line.quantity == null ? "" : formatAmount(line.quantity), "num")}
      ${cell(formatAmount(line.pricePerSet), "num")}
      ${cell(formatAmount(line.lineTotal), "num")}
      ${cell(formatAmount(line.weightKg), "num")}
      ${cell(line.spec, "wrap")}
      ${cell(line.note, "wrap")}
    </tr>`;
  }).join("");
  const info = [
    ["Khách hàng", input.customer.customerName ?? ""],
    ["Công ty", input.customer.companyName ?? ""],
    ["Địa chỉ", input.customer.address ?? ""],
    ["SĐT", input.customer.phone ?? ""],
    ["Email", input.customer.email ?? ""],
  ].map(([label, value]) => `<tr class="info"><td>${escapeHtml(label)}</td><td colspan="7">${escapeHtml(value)}</td></tr>`).join("");

  return `<table class="sheet">
    <tr>
      <td class="logo" rowspan="1"><img src="${escapeHtml(input.logoUrl)}" alt="SpeeGo"></td>
      <td class="company" colspan="7">
        <strong>${escapeHtml(companyLines[0] ?? "")}</strong><br>
        ${companyLines.slice(1).map((line) => `- ${escapeHtml(line)}`).join("<br>")}
      </td>
    </tr>
    <tr><td class="banner" colspan="8">THÔNG TIN ĐƠN HÀNG</td></tr>
    ${info}
    <tr class="head">
      <th>STT</th><th>Hình ảnh</th><th>Số lượng (set)</th><th>Giá/set (AUS)</th>
      <th>Tổng tiền hàng</th><th>Cân nặng (KG)</th><th>Thông số</th><th>Note</th>
    </tr>
    ${rows}
    <tr class="total">
      <td colspan="4">${escapeHtml(input.notes.totalLabel)}</td>
      <td class="num">${totals.priced ? formatAmount(totals.goods) : ""}</td>
      <td class="num">${totals.weighed ? formatAmount(totals.weight) : ""}</td>
      <td></td>
      <td class="wrap">${escapeHtml(input.notes.weightNote)}</td>
    </tr>
    <tr><td colspan="7"></td><td class="wrap">${escapeHtml(input.notes.validityNote)}</td></tr>
    <tr class="deposit">
      <td colspan="4">${escapeHtml(input.notes.deposit)}</td>
      <td class="num">${totals.priced ? formatAmount(totals.goods) : ""}</td>
      <td colspan="3"></td>
    </tr>
    <tr><td colspan="8" class="gap"></td></tr>
    <tr><td class="bank-title" colspan="8">${escapeHtml(input.bank.title)}</td></tr>
    <tr><td colspan="8">- Account Name: ${escapeHtml(input.bank.accountName)}</td></tr>
    <tr><td colspan="8">- Account Number: ${escapeHtml(input.bank.accountNumber)}</td></tr>
    <tr><td colspan="8">- Routing Number: ${escapeHtml(input.bank.routingNumber)}</td></tr>
    <tr class="sign">
      <td colspan="4">ĐẠI DIỆN BÊN A<br>(Ký, đóng dấu)</td>
      <td colspan="4">ĐẠI DIỆN BÊN B<br>(Ký, đóng dấu)</td>
    </tr>
  </table>`;
}

export const quotePrintCss = `
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #000; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
  .logo { width: 92px; background: #d9ead3; text-align: center; }
  .logo img { width: 78px; height: auto; }
  .company { background: #d9ead3; font-size: 9pt; line-height: 1.35; }
  .banner { background: #4a86e8; color: #fff; font-weight: 700; text-align: center; letter-spacing: 0.04em; }
  .info td { background: #fff; }
  .head th { background: #f6b26b; font-weight: 700; text-align: center; }
  .stt { text-align: center; font-weight: 700; width: 36px; }
  .num { text-align: center; white-space: nowrap; }
  .image { width: 92px; text-align: center; }
  .image img { max-width: 84px; max-height: 84px; object-fit: contain; }
  .wrap { white-space: pre-wrap; text-align: left; }
  .total td { font-weight: 700; }
  .bank-title { font-weight: 700; border-bottom: none; }
  .gap { height: 18px; border-left-color: transparent; border-right-color: transparent; }
  .sign td { height: 110px; text-align: center; vertical-align: top; font-weight: 700; padding-top: 12px; }
`;

export function printQuoteSheet(html: string): void {
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
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Báo giá</title><style>${quotePrintCss}</style></head><body>${html}</body></html>`);
  doc.close();
  win.focus();
  win.print();
  win.addEventListener("afterprint", () => frame.remove());
}
