import ExcelJS from "exceljs";
import { createDataLanhSchema, type CreateDataLanhInput, type DataLanhRecord } from "@speego/shared";
import { AppError } from "../lib/errors";
import { normalizeKey, readWorkbook } from "./crm-import-sheets";

const columns = [
  ["fullName", "Họ và tên khách hàng"], ["company", "Tên tiệm / Công ty / Brand"],
  ["phone", "Số điện thoại / WhatsApp / Zalo"], ["facebookLink", "Link Facebook"],
  ["market", "Quốc gia / Thị trường"], ["segment", "Mảng kinh doanh"],
  ["customerClass", "Phân loại khách"], ["address", "Địa chỉ"],
  ["interest", "Dịch vụ / Mặt hàng quan tâm"], ["history", "Lịch sử CSKH"], ["note", "Ghi chú (Note)"],
] as const;

export async function dataLanhWorkbook(rows: DataLanhRecord[]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Data khách hàng");
  sheet.columns = [
    { key: "id", header: "Mã khách hàng", width: 38 }, { key: "stt", header: "STT", width: 8 },
    ...columns.map(([key, header]) => ({ key, header, width: 30 })),
    { key: "internName", header: "Phụ trách", width: 25 },
    { key: "facebookStatus", header: "Trạng thái Facebook", width: 40 },
    { key: "telesaleStatus", header: "Trạng thái Telesale", width: 40 },
    { key: "saleCareName", header: "Sale care", width: 25 },
  ];
  sheet.getColumn("phone").numFmt = "@";
  rows.forEach(row => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  const guide = book.addWorksheet("huong_dan");
  guide.addRow(["Import chỉ thêm khách mới; không cập nhật thông tin, trạng thái hoặc người phụ trách của khách cũ."]);
  guide.addRow(["Điền tên khách hoặc SĐT. Định dạng SĐT dạng Text để giữ số 0 đầu. SĐT trùng được bỏ qua."]);
  guide.addRow(["Dòng có Mã khách hàng được bỏ qua khi import. Khách mới để trống Mã khách hàng và STT."]);
  guide.addRow(["Phân loại khách: Đã mua hàng / Đã liên hệ, chưa mua / Chưa liên hệ. Tối đa 5.000 dòng/file."]);
  return Buffer.from(await book.xlsx.writeBuffer());
}

export async function importDataLanhWorkbook(buffer: Buffer, save: (inputs: CreateDataLanhInput[]) => Promise<{ created: number; skipped: number }>) {
  let workbook: Awaited<ReturnType<typeof readWorkbook>>;
  try {
    workbook = await readWorkbook(buffer);
  } catch {
    throw new AppError(422, "VALIDATION_ERROR", "Không đọc được Excel. Chọn file .xlsx hợp lệ, tối đa 5.000 dòng mỗi sheet.");
  }
  const sheets = [...workbook.sheets].filter(([name]) => {
    const headers = workbook.headers.get(name) ?? [];
    return headers.includes(normalizeKey(columns[0][1])) || headers.includes(normalizeKey(columns[2][1]));
  });
  if (!sheets.length) throw new AppError(422, "VALIDATION_ERROR", "Không thấy cột tên khách hoặc SĐT. Hãy dùng file Tải mẫu.");
  if (sheets.reduce((sum, [, rows]) => sum + rows.length, 0) > 5000) throw new AppError(422, "VALIDATION_ERROR", "File vượt 5.000 dòng");
  const result = { created: 0, updated: 0, skipped: 0, errorCount: 0, errors: [] as { sheet: string; row: number; message: string }[] };
  const inputs: CreateDataLanhInput[] = [];
  for (const [sheet, rows] of sheets) {
    for (const row of rows) {
      if (row.cells[normalizeKey("Mã khách hàng")]) { result.skipped++; continue; }
      const parsed = createDataLanhSchema.safeParse(Object.fromEntries(columns.map(([key, header]) => [key, row.cells[normalizeKey(header)] || null])));
      if (!parsed.success) {
        result.errorCount++;
        if (result.errors.length < 50) result.errors.push({ sheet, row: row.row, message: parsed.error.issues.map(issue => issue.message).join(", ") });
      } else {
        inputs.push(parsed.data);
      }
    }
  }
  if (inputs.length) {
    try {
      const saved = await save(inputs);
      result.created = saved.created;
      result.skipped += saved.skipped;
    } catch {
      throw new AppError(503, "UNAVAILABLE", "Không lưu được file import. Vui lòng thử lại; kiểm tra danh sách nếu kết nối bị gián đoạn.");
    }
  }
  return result;
}
