import type { QuoteBank, QuoteLine, QuoteNotes, QuoteOrder } from "@speego/shared";

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
    return `<tr class="detail">
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
  const hasText = (value: string | null | undefined) => Boolean(value?.trim());
  const info = [
    ["Khách hàng", input.customer.customerName ?? ""],
    ["Công ty", input.customer.companyName ?? ""],
    ["Địa chỉ", input.customer.address ?? ""],
    ["SĐT", input.customer.phone ?? ""],
    ["Email", input.customer.email ?? ""],
  ]
    .filter(([, value]) => hasText(value))
    .map(([label, value]) => `<tr class="info"><td class="info-label">${escapeHtml(label)}</td><td class="info-value" colspan="7">${escapeHtml(value)}</td></tr>`)
    .join("");

  const totalLabel = input.notes.totalLabel?.trim() ?? "";
  const weightNote = input.notes.weightNote?.trim() ?? "";
  const validityNote = input.notes.validityNote?.trim() ?? "";
  const depositLines = input.notes.deposit.map((line) => line.trim()).filter(Boolean);
  const showTotalRow = Boolean(totalLabel || weightNote);
  const bankLines = [
    input.bank.title?.trim() ? `<tr class="bank-row"><td class="bank-title" colspan="8">${escapeHtml(input.bank.title)}</td></tr>` : "",
    hasText(input.bank.accountName) ? `<tr class="bank-row"><td colspan="8">- Account Name: ${escapeHtml(input.bank.accountName)}</td></tr>` : "",
    hasText(input.bank.accountNumber) ? `<tr class="bank-row"><td colspan="8">- Account Number: ${escapeHtml(input.bank.accountNumber)}</td></tr>` : "",
    hasText(input.bank.routingNumber) ? `<tr class="bank-row"><td colspan="8">- Routing Number: ${escapeHtml(input.bank.routingNumber)}</td></tr>` : "",
  ].join("");

  return `<table class="sheet">
    <tr class="masthead">
      <td class="logo" rowspan="1"><img src="${escapeHtml(input.logoUrl)}" alt="SpeeGo"></td>
      <td class="company" colspan="7">
        <strong>${escapeHtml(companyLines[0] ?? "")}</strong><br>
        ${companyLines.slice(1).map((line) => `- ${escapeHtml(line)}`).join("<br>")}
      </td>
    </tr>
    <tr class="banner-row"><td class="banner" colspan="8">THÔNG TIN ĐƠN HÀNG</td></tr>
    ${info}
    <tr class="spacer-row"><td colspan="8" class="spacer"></td></tr>
    <tr class="head">
      <th>STT</th><th>Hình ảnh</th><th>Số lượng (set)</th><th>Giá/set (AUS)</th>
      <th>Tổng tiền hàng</th><th>Cân nặng (KG)</th><th>Thông số</th><th>Note</th>
    </tr>
    ${rows}
    ${showTotalRow ? `<tr class="notes-row"><td class="notes-label" colspan="4">${escapeHtml(totalLabel)}</td><td class="num notes-value">${totalLabel && totals.priced ? formatAmount(totals.goods) : ""}</td><td class="num notes-value">${totalLabel && totals.weighed ? formatAmount(totals.weight) : ""}</td><td></td><td class="wrap">${escapeHtml(weightNote)}</td></tr>` : ""}
    ${validityNote ? `<tr class="notes-row"><td colspan="7"></td><td class="wrap">${escapeHtml(validityNote)}</td></tr>` : ""}
    ${depositLines.map((line, index) => `<tr class="notes-row deposit">
      <td colspan="4">${escapeHtml(line)}</td>
      <td class="num">${index === 0 && totals.priced ? formatAmount(totals.goods) : ""}</td>
      <td colspan="3"></td>
    </tr>`).join("")}
    <tr class="gap-row"><td colspan="8" class="gap"></td></tr>
    ${bankLines}
    <tr class="sign">
      <td colspan="4">ĐẠI DIỆN BÊN A<br>(Ký, đóng dấu)</td>
      <td colspan="4">ĐẠI DIỆN BÊN B<br>(Ký, đóng dấu)</td>
    </tr>
  </table>`;
}

export const quotePrintCss = `
  @page { size: A4 landscape; margin: 10mm 2cm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #000;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
  }
  .sheet-wrap { padding: 0; }
  table.sheet { width: 100%; border-collapse: collapse; }
  td, th { border: none; padding: 4px 6px; vertical-align: middle; background: transparent; color: #000; }
  .logo { width: 92px; text-align: center; }
  .logo img { width: 78px; height: auto; }
  .company { font-size: 9pt; line-height: 1.35; }
  .banner { font-weight: 700; text-align: center; letter-spacing: 0.04em; padding: 6px 0; }
  .info-label { width: 110px; font-weight: 600; padding: 3px 6px; }
  .info-value { padding: 3px 6px; }
  .spacer { height: 18px; padding: 0; }
  .head th,
  tr.detail td {
    border: 1px solid #000;
  }
  .head th { font-weight: 700; text-align: center; }
  .stt { text-align: center; font-weight: 700; width: 36px; }
  .num { text-align: center; white-space: nowrap; }
  .image { width: 92px; text-align: center; }
  .image img { max-width: 84px; max-height: 84px; object-fit: contain; }
  .wrap { white-space: pre-wrap; text-align: left; }
  .notes-row td { font-weight: 700; padding-top: 8px; }
  .bank-title { font-weight: 700; padding-top: 4px; }
  .gap { height: 18px; }
  .sign td { height: 110px; text-align: center; vertical-align: top; font-weight: 700; padding-top: 16px; }
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
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Báo giá</title><style>${quotePrintCss}</style></head><body><div class="sheet-wrap">${html}</div></body></html>`);
  doc.close();
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

/** Tải PDF từ bản ghi báo giá (ưu tiên mẫu đang chọn). */
export async function downloadQuoteRecordPdf(quote: QuotePdfSource): Promise<void> {
  const order = orderForQuotePdf(quote.orders);
  if (!order) throw new Error("Chưa có mẫu báo giá để tải PDF");
  const filename = `${quote.code || "bao-gia"}${order.name ? `-${order.name}` : ""}`;
  await downloadQuotePdf(
    quoteSheetHtml({
      customer: quote,
      lines: order.lines,
      notes: quote.notes,
      bank: quote.bank,
      logoUrl: `${window.location.origin}/logo.png`,
    }),
    filename,
  );
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
  // Nội dung trong vùng A4 ngang trừ lề trái/phải 2cm (~75.6px @96dpi).
  host.style.width = `${1123 - 76 * 2}px`;
  host.style.background = "#fff";
  host.innerHTML = `<style>${quotePrintCss}</style><div class="sheet-wrap">${html}</div>`;
  document.body.appendChild(host);

  try {
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
    const sideMargin = 20;
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
