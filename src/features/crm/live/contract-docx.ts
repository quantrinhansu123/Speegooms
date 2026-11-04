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
  // Báo giá không có loại hình/bang: để trống thì giữ chỗ trống của mẫu cho Sale điền trong Word.
  const entityType = fields.entityType.trim() || "[Corporation / LLC / Sole Proprietorship / Other]";
  const values: Record<string, string> = { ...fields, entityType, entityLower: entityType.toLocaleLowerCase("en-US"), state: fields.state.trim() || "[State]" };
  xml = xml.replace(/\{\{(\w+)\}\}/g, (_, key: string) => esc(values[key] || "______"));
  xml = xml.replace(/<w:p(?: [^>]*)?>(?:(?!<w:p[ >])[\s\S])*?@@SOW@@[\s\S]*?<\/w:p>/, sowTable(sow));
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
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
  const win = frame.contentWindow!;
  win.addEventListener("afterprint", () => frame.remove());
  win.focus();
  win.print();
}
