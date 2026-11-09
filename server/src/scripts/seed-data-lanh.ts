import ExcelJS from "exceljs";
import pg from "pg";
import { config } from "dotenv";
import { postgresSsl } from "../adapters/postgres/pool";
import { loadEnv } from "../config/env";

/** Nạp data lạnh từ file Excel (sheet đã lọc trùng). Chạy lại an toàn: STT đã có thì bỏ qua. Cách dùng: pnpm tsx src/scripts/seed-data-lanh.ts <file.xlsx> */
config({ path: new URL("../../.env", import.meta.url) });

const file = process.argv[2];
if (!file) throw new Error("Thiếu đường dẫn file Excel");

const text = (value: ExcelJS.CellValue): string | null => {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "object" && !(value instanceof Date)
    ? "richText" in value ? value.richText.map((part) => part.text).join("") : "text" in value ? String(value.text) : "result" in value ? String(value.result ?? "") : String(value)
    : String(value);
  return raw.trim() || null;
};

const book = new ExcelJS.Workbook();
await book.xlsx.readFile(file);
const sheet = book.worksheets.find((s) => s.name.includes("Da loc trung"));
if (!sheet) throw new Error("Không thấy sheet 'Data khach hang - Da loc trung'");
const head = new Map<string, number>();
sheet.getRow(1).eachCell((cell, col) => head.set(String(cell.value), col));
const col = (name: string) => {
  const index = head.get(name);
  if (!index) throw new Error(`Thiếu cột "${name}"`);
  return index;
};
const [cStt, cName, cShop, cPhone, cFb, cMarket, cSegment, cClass, cAddr, cInterest, cHistory, cNote] = [
  "STT", "Họ và tên khách hàng", "Tên tiệm / Công ty / Brand", "Số điện thoại / WhatsApp / Zalo", "Link Facebook",
  "Quốc gia / Thị trường", "Mảng kinh doanh", "Phân loại khách", "Địa chỉ", "Dịch vụ / Mặt hàng quan tâm", "Lịch sử CSKH", "Ghi chú (Note)",
].map(col) as [number, number, number, number, number, number, number, number, number, number, number, number];

const env = loadEnv();
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: postgresSsl(env), max: 1 });
let created = 0;
let skipped = 0;
try {
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const stt = Number(row.getCell(cStt).value);
    if (!Number.isInteger(stt)) continue;
    const result = await pool.query(
      `insert into crm.data_lanh (stt, ho_ten, ten_tiem, so_dien_thoai, link_facebook, thi_truong, mang_kinh_doanh, phan_loai_khach, dia_chi, quan_tam, lich_su_cskh, ghi_chu)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) on conflict (stt) do nothing`,
      [stt, ...[cName, cShop, cPhone, cFb, cMarket, cSegment, cClass, cAddr, cInterest, cHistory, cNote].map((c) => text(row.getCell(c).value))],
    );
    if (result.rowCount) created++;
    else skipped++;
  }
  console.log(`data_lanh: thêm ${created}, bỏ qua ${skipped} (đã có)`);
} finally {
  await pool.end();
}
