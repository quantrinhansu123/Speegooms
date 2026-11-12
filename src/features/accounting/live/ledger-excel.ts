import { createLedgerEntrySchema, ledgerCategoryLabels, ledgerCategories, ledgerAmountVnd, type CreateLedgerEntryInput } from "@speego/shared";
import type { CellValue } from "exceljs";
import { z } from "zod";

export type ExcelLedgerEntry = Omit<CreateLedgerEntryInput, "orderCode" | "reference"> & {
  id: string; orderCode?: string | null; reference?: string | null; reconciled: boolean;
};
export type LedgerImportRow = { row: number; id: string; input: CreateLedgerEntryInput };
export const ledgerExcelLimit = 1000;
const columns = [
  ["id", "Mã dòng", 38], ["date", "Ngày", 15], ["kind", "Loại", 12],
  ["category", "Khoản mục", 26], ["counterparty", "Đối tượng", 32],
  ["orderCode", "Đơn hàng", 24], ["amount", "Số tiền", 20], ["currency", "Tiền tệ", 12],
  ["exchangeRate", "Tỷ giá", 18], ["reference", "Tham chiếu", 28],
] as const;
const optionalColumns = [
  ["receivingAccount", "Tài khoản nhận", 45], ["transactionDate", "Ngày giao dịch", 18],
] as const;

export async function buildLedgerWorkbook(entries: ExcelLedgerEntry[] = []) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Thu chi");
  sheet.columns = [...columns.map(([key, header, width]) => ({ key, header, width })),
    { key: "amountVnd", header: "Thành tiền VND", width: 22 },
    { key: "reconciled", header: "Đối soát", width: 22 },
    ...optionalColumns.map(([key, header, width]) => ({ key, header, width }))];
  for (const entry of entries) sheet.addRow({ ...entry,
    kind: entry.kind === "THU" ? "Thu" : "Chi", category: ledgerCategoryLabels[entry.category],
    amountVnd: ledgerAmountVnd(entry), reconciled: entry.reconciled ? "Đã đối soát" : "Chờ đối soát" });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:N1";
  sheet.getColumn("amount").numFmt = "#,##0.00";
  sheet.getColumn("exchangeRate").numFmt = "#,##0.######";
  sheet.getColumn("amountVnd").numFmt = "#,##0.00";
  const instructions = workbook.addWorksheet("Hướng dẫn");
  instructions.getColumn(1).width = 120;
  [
    "Điền dữ liệu vào sheet Thu chi; giữ nguyên hàng tiêu đề. Ngày: YYYY-MM-DD hoặc ô ngày Excel.",
    "Mã dòng trống: thêm mới. Giữ Mã dòng từ file xuất: cập nhật khoản cũ. Không tự sửa hoặc sao chép mã này.",
    "Loại: Thu hoặc Chi. Khoản mục: " + Object.values(ledgerCategoryLabels).join(", ") + ".",
    "Số tiền là số dương; tiền tệ: VND, USD, AUD, EUR, GBP, CAD, SGD, CNY, JPY. Tỷ giá quy đổi VND bắt buộc với ngoại tệ; VND dùng 1.",
    "Đơn hàng và tham chiếu có thể để trống. Nếu điền đơn hàng, dùng mã có trên hệ thống.",
    "Ngày là ngày ghi sổ. Ngày giao dịch là ngày thực tế, nhập riêng (YYYY-MM-DD hoặc ô ngày Excel); có thể để trống.",
    "Tài khoản nhận: nhập ngân hàng, số tài khoản và chủ tài khoản. Dùng đúng tên đã lưu; tên mới được thêm vào danh sách dùng chung khi xác nhận import.",
    "File cũ thiếu cột Tài khoản nhận hoặc Ngày giao dịch vẫn nhập được và giữ nguyên trường đó khi cập nhật. Có cột nhưng ô trống sẽ xóa giá trị trường đó.",
    "Thành tiền VND và Đối soát chỉ để xem. Không nhập trạng thái đối soát từ Excel; dòng đã đối soát không được sửa.",
    `Mỗi lần nhập tối đa ${ledgerExcelLimit} dòng, file .xlsx tối đa 10 MB. Kiểm tra bản xem trước rồi xác nhận nhập.`,
    "Dòng lỗi không được lưu; các dòng khác vẫn được lưu. Chỉ sửa và nhập lại các dòng lỗi để tránh thêm trùng dòng mới.",
  ].forEach((line) => instructions.addRow([line]));
  return workbook;
}

function text(value: CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  throw new Error("Chỉ nhận giá trị, không nhận công thức, liên kết hoặc lỗi ô Excel");
}
function number(value: CellValue): number {
  const raw = text(value);
  return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}

export async function readLedgerWorkbook(buffer: ArrayBuffer) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); }
  catch { throw new Error("Không đọc được file .xlsx. Hãy lưu lại bằng Excel và thử lại."); }
  const sheet = workbook.getWorksheet("Thu chi");
  if (!sheet) throw new Error("Thiếu sheet Thu chi. Hãy dùng file mẫu hoặc file xuất từ hệ thống.");
  if (sheet.rowCount > ledgerExcelLimit + 1) throw new Error(`Tối đa ${ledgerExcelLimit} dòng mỗi lần nhập.`);
  const positions = columns.map(([, header]) => {
    const matches: number[] = [];
    sheet.getRow(1).eachCell((cell, col) => { if (text(cell.value) === header) matches.push(col); });
    if (matches.length !== 1) throw new Error(`Thiếu hoặc trùng cột ${header}. Hãy dùng file mẫu.`);
    return matches[0];
  });
  const optionalPositions = optionalColumns.map(([, header]) => {
    const matches: number[] = [];
    sheet.getRow(1).eachCell((cell, col) => { if (text(cell.value) === header) matches.push(col); });
    if (matches.length > 1) throw new Error(`Trùng cột ${header}. Hãy dùng file mẫu.`);
    return matches[0];
  });
  const rows: LedgerImportRow[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  sheet.eachRow((row, index) => {
    if (index === 1 || [...positions, ...optionalPositions.filter(col => col !== undefined)].every((col) => row.getCell(col).value == null || row.getCell(col).value === "")) return;
    try {
      const cells = positions.map((col) => row.getCell(col).value);
      const id = text(cells[0]).toLowerCase();
      if (id && !z.uuid().safeParse(id).success) throw new Error("Mã dòng không hợp lệ");
      if (id && ids.has(id)) throw new Error("Mã dòng trùng trong file");
      if (id) ids.add(id);
      const kind = text(cells[2]).toLocaleUpperCase("vi-VN");
      const categoryText = text(cells[3]);
      const category = ledgerCategories.find((key) => key === categoryText || ledgerCategoryLabels[key] === categoryText);
      const extra: Record<string, unknown> = {};
      optionalPositions.forEach((col, position) => {
        if (col === undefined) return;
        const value = row.getCell(col).value;
        extra[optionalColumns[position][0]] = value instanceof Date ? value.toISOString().slice(0, 10) : text(value) || null;
      });
      const parsed = createLedgerEntrySchema.safeParse({
        ...extra,
        date: cells[1] instanceof Date ? cells[1].toISOString().slice(0, 10) : text(cells[1]),
        kind, category, counterparty: text(cells[4]), orderCode: text(cells[5]), amount: number(cells[6]),
        currency: text(cells[7]).toUpperCase() || "VND",
        exchangeRate: text(cells[8]) ? number(cells[8]) : null, reference: text(cells[9]),
      });
      if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${[...columns, ...optionalColumns].find(([key]) => key === issue.path[0])?.[1] ?? "Dữ liệu"}: ${issue.message}`).join("; "));
      rows.push({ row: index, id, input: parsed.data });
    } catch (cause) { errors.push(`Dòng ${index}: ${cause instanceof Error ? cause.message : "Dữ liệu không hợp lệ"}`); }
  });
  if (!rows.length && !errors.length) throw new Error("File chưa có dữ liệu thu chi.");
  return { rows, errors };
}

export function unchangedLedgerRow(input: CreateLedgerEntryInput, entry: ExcelLedgerEntry): boolean {
  return [...columns, ...optionalColumns].filter(([key]) => key !== "id").every(([key]) => {
    if ((key === "receivingAccount" || key === "transactionDate") && input[key] === undefined) return true;
    if (key === "exchangeRate" && input.currency === "VND") return true;
    return (input[key as keyof CreateLedgerEntryInput] || "") === (entry[key as keyof ExcelLedgerEntry] || "");
  });
}
