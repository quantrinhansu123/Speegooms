import * as XLSX from "xlsx";
import {
  isTargetPeriodStart, targetTemplateSheets, targetValueSchema,
  type TargetMember, type TargetMetric, type TargetPeriod,
} from "@speego/shared";

export type TargetImportRow = { period: TargetPeriod; start: string; userId: string; code: string; value: number };

const idHeader = "Mã nhân viên";
const nameHeader = "Họ tên";
const startHeader = "Ngày bắt đầu kỳ (yyyy-mm-dd)";
const metricHeader = (metric: TargetMetric) => `${metric.name} (${metric.unit})`;

const text = (value: unknown) => (value == null ? "" : String(value).trim());
const day = (value: unknown): string => {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}` : "";
  }
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const vn = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return vn ? `${vn[3]}-${vn[2]!.padStart(2, "0")}-${vn[1]!.padStart(2, "0")}` : "";
};

/** Số trong ô: chấp nhận 1.500.000 / 1500000 / 12,5. Trả null nếu không phải số. */
function numberOf(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = text(value).replace(/\s/g, "");
  if (!raw) return null;
  const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Bảng mẫu một sheet: mỗi người một dòng, kỳ điền sẵn, các cột chỉ tiêu để trống (hoặc giá trị đang giao). */
export function targetSheetRows(start: string, members: TargetMember[], metrics: TargetMetric[], values: Record<string, Record<string, number>> = {}) {
  return [
    [idHeader, nameHeader, startHeader, ...metrics.map(metricHeader)],
    ...members.map((member) => [member.id, member.name, start, ...metrics.map((metric) => values[member.id]?.[metric.code] ?? "")]),
  ];
}

export function targetGuideRows(metrics: TargetMetric[]) {
  return [
    ["Hướng dẫn nhập mục tiêu"],
    ["Mỗi sheet là một loại kỳ: Tháng (ngày bắt đầu là mùng 1) hoặc Tuần (ngày bắt đầu là Chủ nhật)."],
    ["Giữ nguyên Mã nhân viên và ngày bắt đầu kỳ. Có thể đổi ngày để giao mục tiêu cho kỳ khác trong cùng file."],
    ["Ô trống nghĩa là không thay đổi. Muốn xóa mục tiêu đã giao, sửa trực tiếp trên màn Giao mục tiêu."],
    ["Chỉ tiêu tỷ lệ nhập theo thang 0–100."],
    [],
    ["Chỉ tiêu áp dụng", ...metrics.map(metricHeader)],
  ];
}

export function buildTargetTemplate(starts: { month: string; week: string }, members: TargetMember[], metrics: TargetMetric[]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(targetSheetRows(starts.month, members, metrics)), targetTemplateSheets.month);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(targetSheetRows(starts.week, members, metrics)), targetTemplateSheets.week);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(targetGuideRows(metrics)), "Hướng dẫn");
  return book;
}

/** Đọc một sheet (mảng các dòng). Trả các ô hợp lệ và danh sách lỗi theo dòng, không bỏ qua âm thầm. */
export function parseTargetSheet(period: TargetPeriod, aoa: unknown[][], members: TargetMember[], metrics: TargetMetric[]) {
  const rows: TargetImportRow[] = [];
  const errors: string[] = [];
  const header = (aoa[0] ?? []).map(text);
  const idColumn = header.indexOf(idHeader);
  const startColumn = header.indexOf(startHeader);
  if (idColumn < 0 || startColumn < 0) return { rows, errors: [`Sheet thiếu cột "${idHeader}" hoặc "${startHeader}". Hãy dùng file mẫu.`] };
  const columns = metrics.map((metric) => ({ metric, index: header.indexOf(metricHeader(metric)) })).filter((column) => column.index >= 0);
  if (columns.length === 0) return { rows, errors: ["Sheet không có cột chỉ tiêu nào khớp. Hãy dùng file mẫu."] };
  const memberIds = new Set(members.map((member) => member.id));
  const seen = new Set<string>();
  aoa.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const userId = text(cells[idColumn]);
    if (!userId && cells.every((cell) => text(cell) === "")) return;
    if (!memberIds.has(userId)) { errors.push(`Dòng ${line}: mã nhân viên "${userId}" không thuộc nhóm đã chọn`); return; }
    const start = day(cells[startColumn]);
    if (!start || !isTargetPeriodStart(period, start)) {
      errors.push(`Dòng ${line}: ngày bắt đầu kỳ phải là ${period === "month" ? "mùng 1 của tháng" : "Chủ nhật"} (yyyy-mm-dd)`);
      return;
    }
    for (const { metric, index } of columns) {
      const cell = cells[index];
      if (text(cell) === "") continue;
      const value = numberOf(cell);
      const checked = value === null ? null : targetValueSchema.safeParse(value);
      if (value === null || !checked?.success) { errors.push(`Dòng ${line}, ${metric.name}: "${text(cell)}" không phải số hợp lệ từ 0 trở lên`); continue; }
      if (metric.kind === "rate" && value > 100) { errors.push(`Dòng ${line}, ${metric.name}: tỷ lệ nhập theo thang 0–100`); continue; }
      const key = `${userId}|${start}|${metric.code}`;
      if (seen.has(key)) { errors.push(`Dòng ${line}: ${userId} đã có mục tiêu ${metric.name} cho kỳ ${start} ở dòng trên`); continue; }
      seen.add(key);
      rows.push({ period, start, userId, code: metric.code, value });
    }
  });
  return { rows, errors };
}

/** Đọc workbook: sheet "Tháng" và "Tuần". Sheet khác bị bỏ qua; file không có sheet nào hợp lệ là lỗi. */
export function parseTargetWorkbook(book: XLSX.WorkBook, members: TargetMember[], metrics: TargetMetric[]) {
  const rows: TargetImportRow[] = [];
  const errors: string[] = [];
  let found = false;
  for (const period of ["month", "week"] as const) {
    const sheet = book.Sheets[targetTemplateSheets[period]];
    if (!sheet) continue;
    found = true;
    const parsed = parseTargetSheet(period, XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" }), members, metrics);
    rows.push(...parsed.rows);
    errors.push(...parsed.errors.map((message) => `${targetTemplateSheets[period]}: ${message}`));
  }
  if (!found) errors.push(`Không thấy sheet "${targetTemplateSheets.month}" hoặc "${targetTemplateSheets.week}". Hãy dùng file mẫu.`);
  return { rows, errors };
}

export async function readTargetFile(file: File, members: TargetMember[], metrics: TargetMetric[]) {
  if (file.size > 5 * 1024 * 1024) throw new Error("File tối đa 5 MB");
  return parseTargetWorkbook(XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false }), members, metrics);
}

export async function downloadTargetTemplate(department: string, starts: { month: string; week: string }, members: TargetMember[], metrics: TargetMetric[]) {
  const { downloadBlob } = await import("@/lib/download");
  const buffer = XLSX.write(buildTargetTemplate(starts, members, metrics), { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  downloadBlob(`SpeeGo_Mau_muc_tieu_${department}.xlsx`, new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}
