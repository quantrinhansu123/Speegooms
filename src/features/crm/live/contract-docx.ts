import JSZip from "jszip";
import type { QuoteLine } from "@speego/shared";

/** Giá trị điền vào mẫu. Khớp các {{token}} trong public/contract-template.docx. */
export type ContractDocFields = {
  // Xanh: lấy từ báo giá / khách hàng
  clientName: string;
  address: string;
  representative: string;
  email: string;
  phone: string;
  // Xanh nhưng báo giá không có dữ liệu: Sale nhập
  entityType: string;
  state: string;
  // Vàng: Sale chỉnh theo đàm phán
  deposit: string;
  refundDays: string;
  sampleDays: string;
  delivery: string;
  longStopDays: string;
  inspectionDays: string;
  quoteDays: string;
  noticeDays: string;
};

export type ContractDocSow = {
  lines: QuoteLine[];
  currency: string;
  productValue: number;
  shippingCost: number;
  totalValue: number;
};

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (value: number | null | undefined, currency: string) =>
  value == null ? "" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ${currency}`;

const cell = (text: string, width: number, bold = false, right = false) =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/>${right ? '<w:jc w:val="right"/>' : ""}</w:pPr>` +
  `<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p></w:tc>`;

/** Bảng báo giá thay cho ảnh chụp trong mẫu (cột: sản phẩm, SL, đơn giá, thành tiền). */
function sowTable({ lines, currency, productValue, shippingCost, totalValue }: ContractDocSow): string {
  const w = [3900, 1200, 2000, 2260];
  const row = (cells: string[], bold = false) =>
    `<w:tr>${cells.map((text, i) => cell(text, w[i]!, bold, i > 0)).join("")}</w:tr>`;
  const total = (label: string, value: number) => row(["", "", label, money(value, currency)], true);
  const rows = [
    row(["Product / Description", "Qty", "Unit price", "Amount"], true),
    ...lines.map((line) =>
      row([
        [line.productName, line.spec].filter(Boolean).join(" — "),
        line.quantity == null ? "" : `${line.quantity} ${line.unit}`,
        money(line.pricePerSet, currency),
        money(line.lineTotal, currency),
      ]),
    ),
    total("Products subtotal", productValue),
    total("Shipping", shippingCost),
    total("Total", totalValue),
  ];
  const border = ["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="auto"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders></w:tblPr>${rows.join("")}</w:tbl><w:p/>`;
}

/** Điền mẫu hợp đồng và trả về file .docx. */
export async function buildContractDoc(fields: ContractDocFields, sow: ContractDocSow): Promise<Blob> {
  const res = await fetch("/contract-template.docx");
  if (!res.ok) throw new Error("Không tải được mẫu hợp đồng");
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  let xml = await zip.file("word/document.xml")!.async("string");
  const values: Record<string, string> = { ...fields, entityLower: fields.entityType.toLocaleLowerCase("en-US") };
  xml = xml.replace(/\{\{(\w+)\}\}/g, (_, key: string) => esc(values[key] || "______"));
  xml = xml.replace(/<w:p(?: [^>]*)?>(?:(?!<w:p[ >])[\s\S])*?@@SOW@@[\s\S]*?<\/w:p>/, sowTable(sow));
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

/**
 * docx-preview chỉ ngắt trang ở chỗ ngắt cứng và chỉ vẽ đầu/chân trang một lần mỗi khối, nên in thẳng sẽ mất lề, đầu/chân
 * trang ở các trang giữa. Ở đây tự chia trang: đo từng khối (đoạn, bảng) rồi xếp vào các trang đúng khổ file Word, mỗi trang
 * có đầu trang, chân trang và số trang riêng. Một khối cao hơn một trang thì tự giãn trang đó.
 * ponytail: ngắt trang theo khối, không tách đoạn giữa chừng; cần tách đoạn dài thì chuyển sang render phía server.
 * Gọi sau khi font đã tải để đo chính xác.
 */
export function layoutContractForPrint(doc: Document): void {
  const sections = [...doc.querySelectorAll<HTMLElement>("section.docx")];
  const first = sections[0];
  if (!first) return;
  const { width, minHeight, paddingTop, paddingRight, paddingBottom, paddingLeft } = doc.defaultView!.getComputedStyle(first);
  const pageHeight = parseFloat(minHeight);
  const bodyHeight = pageHeight - parseFloat(paddingTop) - parseFloat(paddingBottom);
  const topOf = (el: Element) => el.getBoundingClientRect().top - first.getBoundingClientRect().top;
  const header = first.querySelector<HTMLElement>(":scope > header");
  const footer = first.querySelector<HTMLElement>(":scope > footer");
  const headerTop = header ? topOf(header) : 0;
  const footerTop = footer ? topOf(footer) : pageHeight - parseFloat(paddingBottom);

  // Chia khối của từng đoạn/bảng vào các trang theo vị trí đã đo.
  const pages: HTMLElement[][] = [];
  for (const section of sections) {
    const article = section.querySelector<HTMLElement>(":scope > article");
    if (!article) continue;
    const blocks = [...article.children] as HTMLElement[];
    const edges = blocks.map((block) => block.getBoundingClientRect().top);
    edges.push(article.getBoundingClientRect().bottom);
    let page: HTMLElement[] = [];
    let start = edges[0] ?? 0;
    // Tiêu đề (đoạn ngắn, toàn chữ đậm) không được đứng một mình cuối trang: chuyển cùng đoạn sau sang trang mới.
    const isHeading = (block: HTMLElement) => {
      const spans = [...block.querySelectorAll("span")].filter((span) => span.textContent?.trim());
      return block.tagName === "P" && (block.textContent ?? "").trim().length < 100 && spans.length > 0
        && spans.every((span) => Number(doc.defaultView!.getComputedStyle(span).fontWeight) >= 600);
    };
    blocks.forEach((block, index) => {
      if (page.length > 0 && edges[index + 1]! - start > bodyHeight) {
        let moved = 0;
        while (page.length - moved > 1 && isHeading(page[page.length - 1 - moved]!)) moved++;
        const carried = page.splice(page.length - moved, moved);
        pages.push(page);
        page = carried;
        start = edges[index - moved]!;
      }
      page.push(block);
    });
    pages.push(page);
  }

  // "Page x of y" là các span rời (Page / x / of / y): gom text node rồi thay số thật.
  const numbered = (el: HTMLElement, number: number) => {
    const copy = el.cloneNode(true) as HTMLElement;
    const walker = doc.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
    texts.forEach((node, k) => {
      if (/Page\s*$/i.test(node.data) && /^\s*\d+\s*$/.test(texts[k + 1]?.data ?? "") && /^\s*of\s*$/i.test(texts[k + 2]?.data ?? "") && /^\s*\d+\s*$/.test(texts[k + 3]?.data ?? "")) {
        texts[k + 1]!.data = String(number);
        texts[k + 3]!.data = String(pages.length);
      }
    });
    return copy;
  };
  const sheets = pages.map((blocks, index) => {
    const sheet = doc.createElement("div");
    sheet.className = "contract-page docx";
    const body = doc.createElement("div");
    body.className = "contract-body docx";
    body.append(...blocks);
    sheet.append(body);
    if (header) { const el = numbered(header, index + 1); el.classList.add("contract-header"); sheet.append(el); }
    if (footer) { const el = numbered(footer, index + 1); el.classList.add("contract-footer"); sheet.append(el); }
    if (index < pages.length - 1) sheet.style.cssText = "break-after:page;page-break-after:always";
    return sheet;
  });
  sections.forEach((section) => section.remove());
  doc.body.append(...sheets);
  doc.head.insertAdjacentHTML("beforeend", `<style>
    @page { size: ${width} ${minHeight}; margin: 0 }
    body { margin: 0 }
    .contract-page { position: relative; width: ${width}; height: ${minHeight}; overflow: hidden }
    .contract-body { position: absolute; top: ${paddingTop}; left: ${paddingLeft}; right: ${paddingRight} }
    .contract-header, .contract-footer { position: absolute; left: ${paddingLeft}; right: ${paddingRight}; margin: 0 !important }
    .contract-header { top: ${headerTop}px }
    .contract-footer { top: ${footerTop}px }
  </style>`);
}

/**
 * Xuất PDF: dựng .docx vào iframe ẩn rồi in; trình duyệt cho chọn "Lưu dưới dạng PDF".
 * Tên file PDF mặc định lấy từ title.
 * ponytail: dùng hộp thoại in của trình duyệt, nếu cần tải thẳng không hỏi thì chuyển sang render phía server.
 */
export async function printContractPdf(docx: Blob, title: string): Promise<void> {
  const { renderAsync } = await import("docx-preview");
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.title = title;
  doc.head.insertAdjacentHTML("beforeend", "<style>@page{margin:0}body{margin:0}</style>");
  await renderAsync(docx, doc.body, undefined, { inWrapper: false, breakPages: true });
  await doc.fonts.ready;
  layoutContractForPrint(doc);
  const win = frame.contentWindow!;
  win.addEventListener("afterprint", () => frame.remove());
  win.focus();
  win.print();
}
