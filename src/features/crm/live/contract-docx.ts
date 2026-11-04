import JSZip from "jszip";

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

/** Dữ liệu bảng "Proforma invoice" trong Exhibit A, lấy từ báo giá đã gửi cho khách. */
export type ContractDocSow = {
  title: string;
  currency: string;
  lines: { stt: string; unit: string; name: string; price: number | null; quantity: number | null; total: number | null; note: string }[];
  total: number;
  shipping: number;
  grandTotal: number;
  /** Các dòng đặt cọc/thanh toán của báo giá; dòng có "n%" thì tự tính số tiền theo tổng. */
  deposits: string[];
  volumeCbm: number | null;
  weightKg: number | null;
};

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const money = (value: number | null | undefined, currency: string) =>
  value == null ? "" : currency === "USD" ? `$${number(value)}` : `${number(value)} ${currency}`;

type Cell = { text?: string; span?: number; bold?: boolean; blue?: boolean; size?: number; merge?: "start" | "continue" };
const BLUE = "2C529F";
const TEAL = "008888";
const GRID = [560, 660, 2500, 1500, 1300, 1400, 1440];

/** Viền ô: ngoài cùng xanh lục dày, bên trong xám mỏng (thư viện dựng gán viền ngoài cho mọi ô nên phải đặt rõ từng ô). */
function cellBorders(col: number, span: number, firstRow: boolean, lastRow: boolean): string {
  const line = (side: string, outer: boolean) =>
    `<w:${side} w:val="single" w:sz="${outer ? 12 : 4}" w:space="0" w:color="${outer ? TEAL : "595959"}"/>`;
  return `<w:tcBorders>${line("top", firstRow)}${line("left", col === 0)}${line("bottom", lastRow)}${line("right", col + span === GRID.length)}</w:tcBorders>`;
}

function cell({ text = "", span = 1, bold, blue, size = 18, merge }: Cell, col: number, firstRow: boolean, lastRow: boolean): string {
  const width = GRID.slice(col, col + span).reduce((sum, w) => sum + w, 0);
  const rPr = `<w:rPr>${bold ? "<w:b/>" : ""}${blue ? `<w:color w:val="${BLUE}"/>` : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
  // Nhiều dòng trong một ô là xuống dòng trong một đoạn (như Word), không phải nhiều đoạn.
  const runs = text.split("\n").map((line) => `<w:r>${rPr}<w:t xml:space="preserve">${esc(line)}</w:t></w:r>`).join(`<w:r>${rPr}<w:br/></w:r>`);
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}` +
    `${merge === "start" ? '<w:vMerge w:val="restart"/>' : merge === "continue" ? "<w:vMerge/>" : ""}${cellBorders(col, span, firstRow, lastRow)}` +
    `<w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr>${text ? runs : ""}</w:p></w:tc>`;
}

function row(cells: Cell[], firstRow: boolean, lastRow: boolean): string {
  let col = 0;
  const out = cells.map((c) => { const xml = cell(c, col, firstRow, lastRow); col += c.span ?? 1; return xml; });
  return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${out.join("")}</w:tr>`;
}

/** Bảng Proforma invoice thay cho ảnh chụp trong mẫu: tiêu đề, cột NO./Unit/Product Type/Unit Price/Quantity/Amount/Remarks, tổng, đặt cọc, thể tích/cân nặng. */
function sowTable(sow: ContractDocSow): string {
  const { currency } = sow;
  const head = (text: string) => ({ text, bold: true });
  const rows: Cell[][] = [
    [{ text: sow.title, span: 7, bold: true, blue: true, size: 32 }],
    [head("NO."), head("Unit"), head("Product Type"), head(`Unit Price\n(${currency})`), head("Quantity"), head(`Amount\n(${currency})`), head("Remarks")],
    ...sow.lines.map((line): Cell[] => [
      { text: line.stt }, { text: line.unit }, { text: line.name }, { text: money(line.price, currency) },
      { text: line.quantity == null ? "" : number(line.quantity) }, { text: money(line.total, currency) }, { text: line.note },
    ]),
  ];
  const summary: [string, string][] = [["Total Amount", money(sow.total, currency)]];
  if (sow.shipping > 0) {
    summary.push(["Shipping", money(sow.shipping, currency)], ["Total (including shipping)", money(sow.grandTotal, currency)]);
  }
  for (const label of sow.deposits) {
    const percent = /(\d+(?:[.,]\d+)?)\s*%/.exec(label)?.[1];
    summary.push([label, percent ? money(Math.round(sow.total * Number(percent.replace(",", ".")) ) / 100, currency) : ""]);
  }
  summary.forEach(([label, value], index) => rows.push([
    { text: label, span: 4, bold: true, blue: true }, { text: value, span: 2, bold: true, blue: true },
    { merge: index === 0 ? "start" : "continue" },
  ]));
  if (sow.volumeCbm || sow.weightKg) {
    rows.push([
      { text: "Estimated volume (m³)", span: 3, bold: true, blue: true }, { text: sow.volumeCbm ? number(sow.volumeCbm) : "", bold: true, blue: true },
      { text: "Estimated weight (KG)", span: 2, bold: true, blue: true }, { text: sow.weightKg ? number(sow.weightKg) : "", bold: true, blue: true },
    ]);
  }
  const inner = `<w:insideH w:val="single" w:sz="4" w:space="0" w:color="595959"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="595959"/>`;
  const outer = ["top", "left", "bottom", "right"].map((side) => `<w:${side} w:val="single" w:sz="12" w:space="0" w:color="${TEAL}"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>${outer}${inner}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${GRID.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.map((cells, index) => row(cells, index === 0, index === rows.length - 1)).join("")}</w:tbl><w:p/>`;
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

type BorderSpacing = { top: number; bottom: number };

/** Khoảng đệm (pt) giữa chữ và đường viền của từng đoạn có viền, theo thứ tự trong file. Thư viện dựng bỏ qua w:space nên bản in thiếu khoảng này. */
export async function readBorderSpacing(docx: Blob): Promise<{ body: BorderSpacing[]; header: BorderSpacing[]; footer: BorderSpacing[] }> {
  const zip = await JSZip.loadAsync(docx);
  const names = Object.keys(zip.files);
  const read = async (name: string | undefined): Promise<BorderSpacing[]> => {
    if (!name) return [];
    const xml = await zip.file(name)!.async("string");
    const space = (borders: string, side: string) => Number(new RegExp(`<w:${side} [^>]*w:space="(\\d+)"`).exec(borders)?.[1] ?? 0);
    return [...xml.matchAll(/<w:p(?:\s[^>]*?)?(?<!\/)>[\s\S]*?<\/w:p>/g)]
      .map((match) => /<w:pBdr>([\s\S]*?)<\/w:pBdr>/.exec(match[0])?.[1])
      .filter((borders): borders is string => borders !== undefined)
      .map((borders) => ({ top: space(borders, "top"), bottom: space(borders, "bottom") }));
  };
  return {
    body: await read("word/document.xml"),
    header: await read(names.find((name) => /^word\/header\d*\.xml$/.test(name))),
    footer: await read(names.find((name) => /^word\/footer\d*\.xml$/.test(name))),
  };
}

/**
 * Hệ số dòng "nhiều dòng" (line-height: 1.25) của Word nhân với chiều cao dòng tự nhiên của phông (Calibri ≈ 1,2207 lần cỡ chữ),
 * còn CSS nhân với cỡ chữ của thẻ đoạn (16px): dòng ra sát hơn Word ~10%. Quy đổi sang px theo cỡ chữ thực của đoạn.
 */
export function matchWordLineHeight(doc: Document): void {
  const NATURAL = 1.2207;
  // Chiều cao dòng của Word theo cỡ chữ lớn nhất, gồm cả ký hiệu cuối đoạn (mặc định 11pt); trình duyệt dùng 16px nên dòng trong bảng cao hơn Word.
  // Đoạn trống trong Word vẫn chiếm một dòng; ký tự tab sau dấu đầu dòng phải nhảy tới mốc thụt 18pt (mặc định bị gộp thành dấu cách).
  doc.head.insertAdjacentHTML("beforeend", `<style>
    section.docx p, .contract-body p { font-size: 11pt }
    section.docx p:empty, .contract-body p:empty { min-height: ${NATURAL}em }
    p[class*='docx-num-']:before { white-space: pre; tab-size: 18pt }
  </style>`);
  doc.querySelectorAll<HTMLElement>("section.docx p").forEach((para) => {
    if (!/^[\d.]+$/.test(para.style.lineHeight)) return;
    const size = Math.max(parseFloat(doc.defaultView!.getComputedStyle(para).fontSize), ...[...para.querySelectorAll("span")]
      .filter((span) => span.textContent?.trim())
      .map((span) => parseFloat(doc.defaultView!.getComputedStyle(span).fontSize)));
    if (size > 0) para.style.lineHeight = `${parseFloat(para.style.lineHeight) * NATURAL * size}px`;
  });
}

/** Mốc ngắt trang của Word nằm đầu đoạn tiêu đề có viền: thư viện tách đoạn thành nửa rỗng ở cuối trang trước (còn đường viền, thành đường kẻ thừa). Bỏ nửa rỗng đó. */
export function dropEmptyBorderFragments(doc: Document): void {
  doc.querySelectorAll<HTMLElement>("section.docx > article").forEach((article) => {
    for (let last = article.lastElementChild as HTMLElement | null; last && last.tagName === "P" && !last.textContent?.trim()
      && !last.querySelector("img, table") && (last.style.borderTop || last.style.borderBottom); last = article.lastElementChild as HTMLElement | null) {
      last.remove();
    }
  });
}

/** Gán khoảng đệm viền cho các đoạn có viền trong danh sách (cùng thứ tự với readBorderSpacing); lệch số lượng thì bỏ qua cho an toàn. */
export function applyBorderSpacing(candidates: Iterable<HTMLElement>, spacing: BorderSpacing[]): void {
  const paragraphs = [...candidates].filter((para) => para.style.borderTop || para.style.borderBottom);
  if (paragraphs.length !== spacing.length) return;
  paragraphs.forEach((para, index) => {
    para.style.paddingTop = `${spacing[index]!.top}pt`;
    para.style.paddingBottom = `${spacing[index]!.bottom}pt`;
  });
}

/**
 * docx-preview chỉ ngắt trang ở chỗ ngắt cứng và chỉ vẽ đầu/chân trang một lần mỗi khối, nên in thẳng sẽ mất lề, đầu/chân
 * trang ở các trang giữa. Ở đây tự chia trang: đo từng khối (đoạn, bảng) rồi xếp vào các trang đúng khổ file Word, mỗi trang
 * có đầu trang, chân trang và số trang riêng. Một khối cao hơn một trang thì tự giãn trang đó.
 * ponytail: ngắt trang theo khối, không tách đoạn giữa chừng; cần tách đoạn dài thì chuyển sang render phía server.
 * Gọi sau khi font đã tải để đo chính xác.
 */
export function layoutContractForPrint(doc: Document): void {
  const allSections = [...doc.querySelectorAll<HTMLElement>("section.docx")];
  // Mốc ngắt của Word trùng dấu ngắt trang cứng sinh ra khối rỗng: bỏ khối không có chữ, ảnh hay bảng.
  const sections = allSections.filter((section) => section.querySelector("article")?.textContent?.trim() || section.querySelector("article img, article table"));
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
  const footerHeight = footer ? footer.getBoundingClientRect().height : 0;

  // Chia khối của từng đoạn/bảng vào các trang theo vị trí đã đo.
  // Trang chữ cao hơn khung chữ dưới 6% (Chrome dàn chữ hơi khác Word) thì thu nhỏ vừa khít để giữ đúng một trang Word; tràn nhiều hơn mới tách theo khối.
  const MAX_SHRINK = 1.06;
  const pages: { blocks: HTMLElement[]; height: number }[] = [];
  for (const section of sections) {
    const article = section.querySelector<HTMLElement>(":scope > article");
    if (!article) continue;
    const blocks = [...article.children] as HTMLElement[];
    const edges = blocks.map((block) => block.getBoundingClientRect().top);
    // Đáy của từng khối; đoạn rỗng cuối trang (vô hình) không tính vào chiều cao trang.
    const hasContent = (block: HTMLElement) => Boolean(block.textContent?.trim() || block.querySelector("img, table") || block.tagName === "TABLE");
    const bottoms = blocks.map((block) => block.getBoundingClientRect().bottom);
    const visibleBottom = (from: number, to: number) => {
      for (let k = to; k >= from; k--) if (hasContent(blocks[k]!)) return bottoms[k]!;
      return bottoms[to] ?? edges[from]!;
    };
    let page: HTMLElement[] = [];
    let start = edges[0] ?? 0;
    // Tiêu đề (đoạn ngắn, toàn chữ đậm màu xanh navy) không được đứng một mình cuối trang: chuyển cùng đoạn sau sang trang mới.
    const isHeading = (block: HTMLElement) => {
      const spans = [...block.querySelectorAll("span")].filter((span) => span.textContent?.trim());
      return block.tagName === "P" && (block.textContent ?? "").trim().length < 100 && spans.length > 0
        && spans.every((span) => {
          const style = doc.defaultView!.getComputedStyle(span);
          const [red = 0, , blue = 0] = style.color.match(/\d+/g)?.map(Number) ?? [];
          return Number(style.fontWeight) >= 600 && blue - red > 20;
        });
    };
    blocks.forEach((block, index) => {
      // Khối rỗng không kích hoạt ngắt trang (tránh trang trắng chỉ chứa đoạn rỗng).
      if (page.length > 0 && hasContent(block) && bottoms[index]! - start > bodyHeight * MAX_SHRINK) {
        let moved = 0;
        while (moved < 2 && page.length - moved > 1 && isHeading(page[page.length - 1 - moved]!)) moved++;
        const carried = page.splice(page.length - moved, moved);
        pages.push({ blocks: page, height: visibleBottom(index - moved - page.length, index - moved - 1) - start });
        page = carried;
        start = edges[index - moved]!;
      }
      page.push(block);
    });
    pages.push({ blocks: page, height: visibleBottom(blocks.length - page.length, blocks.length - 1) - start });
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
    alignTabs(copy);
    return copy;
  };
  // docx-preview đổi tab (căn phải/giữa) thành một dấu cách: dựng lại bằng lưới 2-3 cột (trái | giữa | phải) như Word.
  const alignTabs = (el: HTMLElement) => {
    const para = el.querySelector("p");
    if (!para) return;
    const groups: ChildNode[][] = [[]];
    for (const node of [...para.childNodes]) {
      const marker = node.nodeType === 1 ? (node as HTMLElement).firstElementChild : null;
      if (marker && marker.tagName === "SPAN" && marker.textContent?.length === 1 && !marker.textContent.trim() && node.firstChild === marker) {
        marker.remove();
        groups.push([]);
      }
      groups[groups.length - 1]!.push(node);
    }
    if (groups.length < 2) return;
    para.style.display = "grid";
    para.style.alignItems = "end";
    para.style.gridTemplateColumns = groups.length === 2 ? "1fr auto" : "1fr auto 1fr";
    para.replaceChildren(...groups.map((group, index) => {
      const cell = doc.createElement("div");
      cell.style.justifySelf = index === 0 ? "start" : index === groups.length - 1 ? "end" : "center";
      cell.append(...group);
      return cell;
    }));
  };
  const contentWidth = parseFloat(width) - parseFloat(paddingLeft) - parseFloat(paddingRight);
  const sheets = pages.map(({ blocks, height }, index) => {
    const sheet = doc.createElement("div");
    sheet.className = "contract-page docx";
    const body = doc.createElement("div");
    body.className = "contract-body docx";
    body.append(...blocks);
    // Word bỏ khoảng cách trước ở đầu trang.
    if (index > 0 && blocks[0]) blocks[0].style.marginTop = "0";
    if (height > bodyHeight) {
      const scale = bodyHeight / height;
      body.style.cssText = `right:auto;width:${contentWidth / scale}px;transform:scale(${scale});transform-origin:top left`;
    }
    sheet.append(body);
    if (header) { const el = numbered(header, index + 1); el.classList.add("contract-header"); sheet.append(el); }
    if (footer) { const el = numbered(footer, index + 1); el.classList.add("contract-footer"); sheet.append(el); }
    if (index < pages.length - 1) sheet.style.cssText = "break-after:page;page-break-after:always";
    return sheet;
  });
  allSections.forEach((section) => section.remove());
  doc.body.append(...sheets);
  doc.head.insertAdjacentHTML("beforeend", `<style>
    @page { size: ${width} ${minHeight}; margin: 0 }
    body { margin: 0 }
    .contract-page { position: relative; width: ${width}; height: ${minHeight}; overflow: hidden }
    .contract-body { position: absolute; top: ${paddingTop}; left: ${paddingLeft}; right: ${paddingRight} }
    .contract-header, .contract-footer { position: absolute; left: ${paddingLeft}; right: ${paddingRight}; margin: 0 !important }
    .contract-header { top: ${headerTop}px }
    .contract-footer { top: ${footerTop}px; height: ${footerHeight}px; display: flex; flex-direction: column; justify-content: flex-end }
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
  const spacing = await readBorderSpacing(docx);
  // ignoreLastRenderedPageBreak:false → dùng đúng chỗ ngắt trang Word đã lưu trong file, nên số trang và chỗ ngắt khớp Word.
  await renderAsync(docx, doc.body, undefined, { inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false });
  dropEmptyBorderFragments(doc);
  matchWordLineHeight(doc);
  applyBorderSpacing(doc.querySelectorAll<HTMLElement>("section.docx:first-of-type > header p"), spacing.header);
  applyBorderSpacing(doc.querySelectorAll<HTMLElement>("section.docx:first-of-type > footer p"), spacing.footer);
  applyBorderSpacing(doc.querySelectorAll<HTMLElement>("section.docx > article p"), spacing.body);
  // Ảnh (logo) tải bất đồng bộ: in trước khi tải xong thì trang chữ ký mất logo. Đợi cả trước và sau khi chia trang (đầu trang được nhân bản).
  const imagesLoaded = () => Promise.all([...doc.images].map((img) =>
    img.complete ? undefined : new Promise<void>((resolve) => { img.onload = img.onerror = () => resolve(); })));
  await Promise.all([doc.fonts.ready, imagesLoaded()]);
  layoutContractForPrint(doc);
  await imagesLoaded();
  const win = frame.contentWindow!;
  win.addEventListener("afterprint", () => frame.remove());
  win.focus();
  win.print();
}
