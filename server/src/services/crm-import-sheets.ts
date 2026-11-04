import ExcelJS from "exceljs";
import type { CrmLane } from "@speego/shared";

export const importKinds = ["messages", "potentials", "quotes", "contracts"] as const;
export type ImportKind = (typeof importKinds)[number];

export type ImportIssue = { sheet: string; row: number; message: string };

export type PlannedMessage = {
  sheet: string;
  row: number;
  lane: CrmLane;
  externalRef: string;
  customerName: string;
  phone: string;
  email: string;
  goods: string;
  note: string;
  demand?: "SHIPPING" | "SOURCING";
  customerType?: "INDIVIDUAL" | "PRINCIPAL" | "ENTERPRISE";
  receivedOn: string;
  market: string;
  classification?: "HOT" | "WARM" | "COLD" | "DEAD";
  saleName: string;
  painPoint: string;
  linkMess: string;
};

export type PlannedPotential = {
  sheet: string;
  row: number;
  lane: CrmLane;
  externalRef: string;
  messRef: string;
  fullName: string;
  companyName: string;
  phone: string;
  email: string;
  goods: string;
  quantityNote: string;
  address: string;
  saleNote: string;
  potential: "POTENTIAL" | "CLOSING" | "DEPOSITED" | "NOT_ORDERED";
  kind: "SOURCING" | "LOGISTICS" | "BOTH" | null;
  careChannel: string;
  packSpec: string;
  packageDimensions: string;
  weightKg: string | null;
  shipFrom: string;
  shipTo: string;
  requirements: string;
};

export type PlannedQuote = {
  sheet: string;
  row: number;
  lane: CrmLane;
  externalRef: string;
  goods: string;
  quantity: number | null;
  weightKg: number | null;
  spec: string;
  requirements: string;
  productPrice: number | null;
  freight: number | null;
  currency: string;
  kind: "SOURCING" | "LOGISTICS" | "BOTH" | null;
};

export type PlannedContract = {
  sheet: string;
  row: number;
  lane: CrmLane;
  rfqRef: string;
  customerName: string;
  saleName: string;
  product: string;
  quantity: number | null;
  productValue: number;
  shippingCost: number;
  totalValue: number;
  paidAmount: number;
  signedOn: string;
  currency: "USD" | "VND";
  tracking: string;
};

export type SheetPlan<T> = { rows: T[]; errors: ImportIssue[]; skipped: number };

type GridRow = { row: number; cells: Record<string, string> };
type WorkbookData = { sheets: Map<string, GridRow[]> };

const MAX_ROWS = 5000;
const DATE_KEYS = new Set(["ngay_nhan", "ngay_ky"]);

const templateFiles: Record<ImportKind, string> = {
  messages: "mau-mess.xlsx",
  potentials: "mau-tiem-nang.xlsx",
  quotes: "mau-bao-gia.xlsx",
  contracts: "mau-hop-dong.xlsx",
};

export function isImportKind(value: string): value is ImportKind {
  return (importKinds as readonly string[]).includes(value);
}

export async function readWorkbook(buffer: Buffer): Promise<WorkbookData> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]);
  const sheets = new Map<string, GridRow[]>();
  for (const worksheet of book.worksheets) {
    const name = normalizeKey(worksheet.name);
    if (!name || name === "huong_dan") continue;
    let headers: string[] = [];
    const rows: GridRow[] = [];
    worksheet.eachRow({ includeEmpty: false }, (excelRow, rowNumber) => {
      if (headers.length === 0) {
        headers = excelRow.values instanceof Array
          ? excelRow.values.slice(1).map((value, index) => normalizeKey(cellText(value, false)) || `cot_${index + 1}`)
          : [];
        return;
      }
      const cells: Record<string, string> = {};
      headers.forEach((header, index) => {
        const text = cellText(excelRow.getCell(index + 1).value, DATE_KEYS.has(header));
        if (text) cells[header] = text;
      });
      if (Object.keys(cells).length > 0) rows.push({ row: rowNumber, cells });
    });
    if (rows.length > MAX_ROWS) {
      throw new Error(`Sheet ${worksheet.name} vượt ${MAX_ROWS} dòng`);
    }
    sheets.set(name, rows);
  }
  return { sheets };
}

export async function buildTemplate(kind: ImportKind): Promise<{ name: string; body: Buffer }> {
  const book = new ExcelJS.Workbook();
  book.creator = "Speego";
  const guide = book.addWorksheet("huong_dan");
  guide.addRow(["Mục", "Cách dùng"]);
  guide.addRow(["Tuyến", "Điền phong_sale = Sale VN hoặc Sale Global. Sheet phan_phong cũng được dùng để tách tuyến."]);
  guide.addRow(["Dòng ví dụ", "Mã bắt đầu bằng VD- chỉ để xem mẫu, import sẽ bỏ qua."]);
  guide.addRow(["Thứ tự", "Nhập Mess trước, rồi Khách tiềm năng, Báo giá, cuối cùng là Hợp đồng."]);
  guide.getRow(1).font = { bold: true };

  if (kind === "messages") {
    addSheet(book, "mess", [
      "mess_id", "customer_id", "ten_khach", "sdt", "email", "mat_hang", "dich_vu", "loai_khach", "ghi_chu", "ngay_nhan", "thi_truong", "phan_loai", "sale_chu", "pain_point", "link_mess", "phong_sale",
    ], ["VD-001", "VD-KH-001", "Nguyen Van A", "0901234567", "a@example.com", "Ghe go", "SOURCING", "INDIVIDUAL", "", "2026-01-15", "My", "HOT", "Lan", "Can bao gia nhanh", "", "Sale VN"]);
    addSheet(book, "customer_pii", ["customer_id", "ten_khach", "sdt", "email", "dia_chi"], ["VD-KH-001", "Nguyen Van A", "0901234567", "a@example.com", "Ha Noi"]);
    addSheet(book, "phan_phong", ["mess_id", "rfq_id", "order_id", "phong_sale"], ["VD-001", "", "", "Sale VN"]);
  }
  if (kind === "potentials") {
    addSheet(book, "rfq", [
      "rfq_id", "mess_id", "customer_id", "trang_thai_rfq", "ten_hang", "so_luong", "yeu_cau_khach", "quy_cach", "can_nang", "diem_di", "diem_den", "dich_vu", "ghi_chu", "kenh_lien_he", "phong_sale",
    ], ["VD-RFQ-001", "VD-001", "VD-KH-001", "POTENTIAL", "Ghe go", "10", "Giao trong 30 ngay", "Thung 2 lop", "12", "Ha Noi", "My", "SOURCING", "", "ZALO", "Sale VN"]);
    addSheet(book, "rfq_pii", ["rfq_id", "ten_khach", "ten_cong_ty", "sdt", "email", "dia_chi"], ["VD-RFQ-001", "Nguyen Van A", "", "0901234567", "a@example.com", "Ha Noi"]);
    addSheet(book, "phan_phong", ["mess_id", "rfq_id", "order_id", "phong_sale"], ["VD-001", "VD-RFQ-001", "", "Sale VN"]);
  }
  if (kind === "quotes") {
    addSheet(book, "rfq", ["rfq_id", "ten_hang", "so_luong", "quy_cach", "can_nang", "yeu_cau_khach", "dich_vu", "phong_sale"], ["VD-RFQ-001", "Ghe go", "10", "Thung 2 lop", "12", "Giao trong 30 ngay", "SOURCING", "Sale VN"]);
    addSheet(book, "rfq_price", ["rfq_id", "gia_bao_usd", "gia_sp_usd", "phi_vc_usd", "tien_te"], ["VD-RFQ-001", "120", "100", "40", "USD"]);
    addSheet(book, "phan_phong", ["mess_id", "rfq_id", "order_id", "phong_sale"], ["", "VD-RFQ-001", "", "Sale VN"]);
  }
  if (kind === "contracts") {
    addSheet(book, "order", ["order_id", "rfq_id", "customer_id", "ten_khach", "ten_hang", "so_luong", "gia_hang_usd", "cuoc_usd", "tracking", "sale_chu", "phong_sale"], ["VD-DON-001", "VD-RFQ-001", "VD-KH-001", "Nguyen Van A", "Ghe go", "10", "1200", "400", "", "Lan", "Sale VN"]);
    addSheet(book, "contract", ["order_id", "ngay_ky", "tong_gia_tri_usd", "tong_gia_tri_vnd", "con_lai_usd"], ["VD-DON-001", "2026-02-01", "1600", "", "800"]);
    addSheet(book, "customer_pii", ["customer_id", "ten_khach", "sdt", "email", "dia_chi"], ["VD-KH-001", "Nguyen Van A", "0901234567", "a@example.com", "Ha Noi"]);
    addSheet(book, "phan_phong", ["mess_id", "rfq_id", "order_id", "phong_sale"], ["", "VD-RFQ-001", "VD-DON-001", "Sale VN"]);
  }

  const out = await book.xlsx.writeBuffer();
  const view = out as unknown as Uint8Array;
  return { name: templateFiles[kind], body: Buffer.from(view.buffer, view.byteOffset, view.byteLength) };
}

export async function planImport(kind: ImportKind, buffer: Buffer, scope: readonly CrmLane[]): Promise<SheetPlan<PlannedMessage | PlannedPotential | PlannedQuote | PlannedContract>> {
  const book = await readWorkbook(buffer);
  if (kind === "messages") return planMessages(book, scope);
  if (kind === "potentials") return planPotentials(book, scope);
  if (kind === "quotes") return planQuotes(book, scope);
  return planContracts(book, scope);
}

export function planMessages(book: WorkbookData, scope: readonly CrmLane[]): SheetPlan<PlannedMessage> {
  const sheet = requireSheet(book, "mess");
  const people = indexBy(book.sheets.get("customer_pii") ?? [], ["customer_id", "ma_khach"]);
  const lanes = laneIndex(book.sheets.get("phan_phong") ?? [], ["mess_id", "ma_mess"]);
  const rows: PlannedMessage[] = [];
  const errors: ImportIssue[] = [];
  let skipped = 0;
  for (const line of sheet) {
    const id = pick(line.cells, ["mess_id", "ma_mess"]);
    if (!id) {
      if (Object.keys(line.cells).length > 0) errors.push({ sheet: "mess", row: line.row, message: "Thiếu mess_id" });
      continue;
    }
    if (isSample(id)) continue;
    const person = people.get(pick(line.cells, ["customer_id", "ma_khach"])) ?? {};
    const cells = overlay(person, line.cells);
    const lane = chosenLane(pick(cells, ["phong_sale"]) || lanes.get(id) || "", scope);
    if (lane === "skip") {
      skipped += 1;
      continue;
    }
    if (typeof lane !== "string") {
      errors.push({ sheet: "mess", row: line.row, message: lane.error });
      continue;
    }
    const phone = digits(pick(cells, ["sdt", "so_dien_thoai", "phone"]));
    const email = mail(pick(cells, ["email", "thu_dien_tu"]));
    if (!phone && !email) {
      errors.push({ sheet: "mess", row: line.row, message: "Cần số điện thoại hoặc email" });
      continue;
    }
    rows.push({
      sheet: "mess",
      row: line.row,
      lane,
      externalRef: id.slice(0, 160),
      customerName: clip(pick(cells, ["ten_khach", "ho_ten", "customer_name"]) || `Khách ${id}`, 160),
      phone,
      email,
      goods: clip(pick(cells, ["mat_hang", "hang_hoa", "ten_hang"]), 500),
      note: clip(pick(cells, ["ghi_chu", "note"]), 2000),
      demand: demandOf(pick(cells, ["dich_vu", "nhu_cau"])),
      customerType: customerTypeOf(pick(cells, ["loai_khach", "loai_khach_hang"])),
      receivedOn: day(pick(cells, ["ngay_nhan", "received_on"])),
      market: clip(pick(cells, ["thi_truong", "market"]), 160),
      classification: heatOf(pick(cells, ["phan_loai", "phan_loai_lead"])),
      saleName: clip(pick(cells, ["sale_chu", "sale", "nhan_vien_ban"]), 160),
      painPoint: clip(painOf(cells), 2000),
      linkMess: clip(pick(cells, ["link_mess"]), 500),
    });
  }
  return { rows, errors, skipped };
}

export function planPotentials(book: WorkbookData, scope: readonly CrmLane[]): SheetPlan<PlannedPotential> {
  const sheet = requireSheet(book, "rfq");
  const people = indexBy(book.sheets.get("rfq_pii") ?? [], ["rfq_id", "ma_rfq"]);
  const lanes = laneIndex(book.sheets.get("phan_phong") ?? [], ["rfq_id", "ma_rfq"]);
  const rows: PlannedPotential[] = [];
  const errors: ImportIssue[] = [];
  let skipped = 0;
  for (const line of sheet) {
    const id = pick(line.cells, ["rfq_id", "ma_rfq"]);
    const messRef = pick(line.cells, ["mess_id", "ma_mess"]);
    if (!id && !messRef) continue;
    if (!id) {
      errors.push({ sheet: "rfq", row: line.row, message: "Thiếu rfq_id" });
      continue;
    }
    if (isSample(id)) continue;
    if (!messRef) {
      errors.push({ sheet: "rfq", row: line.row, message: "Thiếu mess_id. Hãy import Mess trước." });
      continue;
    }
    const cells = overlay(people.get(id) ?? {}, line.cells);
    const lane = chosenLane(pick(cells, ["phong_sale"]) || lanes.get(id) || "", scope);
    if (lane === "skip") {
      skipped += 1;
      continue;
    }
    if (typeof lane !== "string") {
      errors.push({ sheet: "rfq", row: line.row, message: lane.error });
      continue;
    }
    const weight = clip(pick(cells, ["can_nang", "trong_luong_kg"]), 500);
    rows.push({
      sheet: "rfq",
      row: line.row,
      lane,
      externalRef: id.slice(0, 160),
      messRef: messRef.slice(0, 160),
      fullName: clip(pick(cells, ["ten_khach", "ho_ten"]), 160),
      companyName: clip(pick(cells, ["ten_cong_ty"]), 160),
      phone: digits(pick(cells, ["sdt", "so_dien_thoai", "phone"])),
      email: mail(pick(cells, ["email", "thu_dien_tu"])),
      goods: clip(pick(cells, ["ten_hang", "mat_hang", "hang_hoa"]), 500),
      quantityNote: clip(pick(cells, ["so_luong"]), 500),
      address: clip(pick(cells, ["dia_chi"]), 300),
      saleNote: clip(pick(cells, ["ghi_chu"]), 2000),
      potential: potentialOf(pick(cells, ["trang_thai_rfq", "trang_thai", "tiem_nang"])),
      kind: kindOf(pick(cells, ["dich_vu", "loai_khach", "nhom_khach"])),
      careChannel: careOf(pick(cells, ["kenh_lien_he", "kenh_cham_soc"])),
      packSpec: clip(pick(cells, ["quy_cach", "quy_cach_dong_goi"]), 2000),
      packageDimensions: clip(pick(cells, ["kich_thuoc_kien_hang", "kich_thuoc_kien"]), 500),
      weightKg: weight || null,
      shipFrom: clip(pick(cells, ["diem_di", "dia_chi_lay", "dia_chi_gui"]), 2000),
      shipTo: clip(pick(cells, ["diem_den", "dia_chi_nhan"]), 2000),
      requirements: clip(pick(cells, ["yeu_cau_khach", "yeu_cau"]), 8000),
    });
  }
  return { rows, errors, skipped };
}

export function planQuotes(book: WorkbookData, scope: readonly CrmLane[]): SheetPlan<PlannedQuote> {
  const sheet = requireSheet(book, "rfq");
  const prices = indexBy(book.sheets.get("rfq_price") ?? [], ["rfq_id", "ma_rfq"]);
  const lanes = laneIndex(book.sheets.get("phan_phong") ?? [], ["rfq_id", "ma_rfq"]);
  const rows: PlannedQuote[] = [];
  const errors: ImportIssue[] = [];
  let skipped = 0;
  for (const line of sheet) {
    const id = pick(line.cells, ["rfq_id", "ma_rfq"]);
    if (!id) continue;
    if (isSample(id)) continue;
    const cells = overlay(prices.get(id) ?? {}, line.cells);
    const lane = chosenLane(pick(cells, ["phong_sale"]) || lanes.get(id) || "", scope);
    if (lane === "skip") {
      skipped += 1;
      continue;
    }
    if (typeof lane !== "string") {
      errors.push({ sheet: "rfq", row: line.row, message: lane.error });
      continue;
    }
    const productPrice = numberOf(pick(cells, ["gia_bao_usd", "gia_sp_usd", "don_gia", "gia_hang_usd", "gia_hang"]));
    const freight = numberOf(pick(cells, ["phi_vc_usd", "phi_van_chuyen", "cuoc_usd", "cuoc"]));
    const named = kindOf(pick(cells, ["dich_vu", "loai_khach"]));
    const kind = named === "BOTH" || (productPrice != null && freight != null)
      ? "BOTH"
      : named ?? (freight != null ? "LOGISTICS" : productPrice != null ? "SOURCING" : null);
    rows.push({
      sheet: "rfq",
      row: line.row,
      lane,
      externalRef: id.slice(0, 160),
      goods: clip(pick(cells, ["ten_hang", "mat_hang"]) || "Đơn hàng", 160),
      quantity: numberOf(pick(cells, ["so_luong"])),
      weightKg: numberOf(pick(cells, ["can_nang"])),
      spec: clip(pick(cells, ["quy_cach"]), 4000),
      requirements: clip(pick(cells, ["yeu_cau_khach", "yeu_cau"]), 4000),
      productPrice,
      freight,
      currency: currencyOf(pick(cells, ["tien_te", "currency"])),
      kind,
    });
  }
  return { rows, errors, skipped };
}

export function planContracts(book: WorkbookData, scope: readonly CrmLane[]): SheetPlan<PlannedContract> {
  const sheet = requireSheet(book, "order");
  const contracts = indexBy(book.sheets.get("contract") ?? [], ["order_id", "ma_don"]);
  const people = indexBy(book.sheets.get("customer_pii") ?? [], ["customer_id", "ma_khach"]);
  const lanes = laneIndex(book.sheets.get("phan_phong") ?? [], ["order_id", "ma_don"]);
  const rows: PlannedContract[] = [];
  const errors: ImportIssue[] = [];
  let skipped = 0;
  for (const line of sheet) {
    const id = pick(line.cells, ["order_id", "ma_don"]);
    const rfqRef = pick(line.cells, ["rfq_id", "ma_rfq"]);
    if (!id && !rfqRef) continue;
    if (!id) {
      errors.push({ sheet: "order", row: line.row, message: "Thiếu order_id" });
      continue;
    }
    if (isSample(id)) continue;
    if (!rfqRef || isSample(rfqRef)) {
      errors.push({ sheet: "order", row: line.row, message: "Thiếu rfq_id của báo giá đã nhập" });
      continue;
    }
    const contract = contracts.get(id) ?? {};
    const person = people.get(pick(line.cells, ["customer_id", "ma_khach"])) ?? {};
    const cells = overlay(overlay(person, contract), line.cells);
    const lane = chosenLane(pick(cells, ["phong_sale"]) || lanes.get(id) || "", scope);
    if (lane === "skip") {
      skipped += 1;
      continue;
    }
    if (typeof lane !== "string") {
      errors.push({ sheet: "order", row: line.row, message: lane.error });
      continue;
    }
    const productValue = numberOf(pick(cells, ["gia_hang_usd", "gia_hang", "gia_tri_san_pham"])) ?? 0;
    const shippingCost = numberOf(pick(cells, ["cuoc_usd", "cuoc", "phi_vc_usd", "chi_phi_van_chuyen"])) ?? 0;
    const totalUsd = numberOf(pick(cells, ["tong_gia_tri_usd", "tong_usd"]));
    const totalVnd = numberOf(pick(cells, ["tong_gia_tri_vnd", "tong_vnd"]));
    const currency = totalVnd != null && totalUsd == null ? "VND" : "USD";
    const totalValue = (currency === "VND" ? totalVnd : totalUsd) ?? roundMoney(productValue + shippingCost);
    const remaining = numberOf(pick(cells, ["con_lai_usd", "con_lai"])) ?? 0;
    const paidAmount = Math.min(totalValue, Math.max(0, roundMoney(totalValue - remaining)));
    const customerName = clip(pick(cells, ["ten_khach", "ho_ten"]) || `Khách ${pick(cells, ["customer_id", "ma_khach"]) || id}`, 200);
    if (!customerName.trim()) {
      errors.push({ sheet: "order", row: line.row, message: "Thiếu tên khách" });
      continue;
    }
    rows.push({
      sheet: "order",
      row: line.row,
      lane,
      rfqRef: rfqRef.slice(0, 160),
      customerName,
      saleName: clip(pick(cells, ["sale_chu", "sale"]), 160),
      product: clip(pick(cells, ["ten_hang", "san_pham"]), 300),
      quantity: numberOf(pick(cells, ["so_luong"])),
      productValue: roundMoney(productValue),
      shippingCost: roundMoney(shippingCost),
      totalValue: roundMoney(totalValue),
      paidAmount,
      signedOn: day(pick(cells, ["ngay_ky"])),
      currency,
      tracking: clip(pick(cells, ["tracking"]), 200),
    });
  }
  return { rows, errors, skipped };
}

function addSheet(book: ExcelJS.Workbook, name: string, headers: string[], example: string[]) {
  const sheet = book.addWorksheet(name);
  sheet.addRow(headers);
  sheet.addRow(example);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 18;
  });
}

function requireSheet(book: WorkbookData, name: string): GridRow[] {
  const rows = book.sheets.get(name);
  if (!rows) throw new Error(`Không thấy sheet ${name}`);
  return rows;
}

function indexBy(rows: GridRow[], keys: string[]): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const id = pick(row.cells, keys);
    if (id && !isSample(id)) map.set(id, row.cells);
  }
  return map;
}

function laneIndex(rows: GridRow[], keys: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const id = pick(row.cells, keys);
    const lane = pick(row.cells, ["phong_sale"]);
    if (id && lane && !isSample(id)) map.set(id, lane);
  }
  return map;
}

function overlay(base: Record<string, string>, extra: Record<string, string>): Record<string, string> {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) if (value) out[key] = value;
  return out;
}

function pick(cells: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = cells[normalizeKey(key)];
    if (value) return value;
  }
  return "";
}

function chosenLane(phong: string, scope: readonly CrmLane[]): CrmLane | "skip" | { error: string } {
  const found = laneOf(phong);
  if (found && !scope.includes(found)) return "skip";
  if (found) return found;
  if (scope.length === 1) return scope[0];
  return { error: "Không xác định tuyến. Điền phong_sale hoặc sheet phan_phong." };
}

function laneOf(value: string): CrmLane | null {
  const text = normalizeKey(value);
  if (!text) return null;
  if (text.includes("global")) return "global";
  if (text.includes("viet") || text.includes("vn")) return "vn";
  return null;
}

function painOf(cells: Record<string, string>): string {
  const direct = pick(cells, ["pain_point", "ghi_chu_van_de", "pain_point_note"]);
  if (direct) return direct;
  const extra = Object.entries(cells)
    .filter(([key, value]) => key.includes("pain") && value)
    .map(([, value]) => value);
  return extra.join("; ") || "Không ghi pain point";
}

function demandOf(value: string): PlannedMessage["demand"] {
  const kind = kindOf(value);
  if (kind === "LOGISTICS") return "SHIPPING";
  if (kind === "SOURCING" || kind === "BOTH") return "SOURCING";
  return undefined;
}

function kindOf(value: string): PlannedPotential["kind"] {
  const text = normalizeKey(value);
  if (!text) return null;
  const logistics = /logistic|van_chuyen|shipping|van_tai/.test(text);
  const sourcing = /sourc|tim_hang|tim_nguon/.test(text);
  if (logistics && sourcing) return "BOTH";
  if (logistics) return "LOGISTICS";
  if (sourcing) return "SOURCING";
  return null;
}

function customerTypeOf(value: string): PlannedMessage["customerType"] {
  const text = normalizeKey(value);
  if (text.includes("enterprise") || text.includes("doanh_nghiep")) return "ENTERPRISE";
  if (text.includes("principal") || text === "chu") return "PRINCIPAL";
  if (text.includes("individual") || text.includes("ca_nhan")) return "INDIVIDUAL";
  return undefined;
}

function heatOf(value: string): PlannedMessage["classification"] {
  const text = normalizeKey(value);
  if (text === "hot" || text === "nong") return "HOT";
  if (text === "warm" || text === "am") return "WARM";
  if (text === "cold" || text === "lanh") return "COLD";
  if (text === "dead" || text === "chet") return "DEAD";
  return undefined;
}

function potentialOf(value: string): PlannedPotential["potential"] {
  const text = normalizeKey(value);
  if (text.includes("closing") || text.includes("chot")) return "CLOSING";
  if (text.includes("deposit") || text.includes("coc")) return "DEPOSITED";
  if (text.includes("not_ordered") || text.includes("khong_dat") || text.includes("lost")) return "NOT_ORDERED";
  return "POTENTIAL";
}

function careOf(value: string): string {
  const text = normalizeKey(value);
  if (text.includes("facebook")) return "FACEBOOK";
  if (text.includes("zalo")) return "ZALO";
  if (text.includes("whatsapp")) return "WHATSAPP";
  if (text.includes("viber")) return "VIBER";
  return "";
}

function currencyOf(value: string): string {
  const text = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(text) ? text : "USD";
}

function digits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 30);
}

function mail(value: string): string {
  const text = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text.slice(0, 160) : "";
}

function numberOf(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  let text = raw.replace(/\s/g, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    const parts = text.split(",");
    text = parts[parts.length - 1]?.length === 3 ? text.replace(/,/g, "") : text.replace(",", ".");
  }
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) return null;
  return number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function day(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function isSample(id: string): boolean {
  return id.trim().toUpperCase().startsWith("VD-");
}

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function cellText(value: ExcelJS.CellValue, date: boolean): string {
  const raw = unwrap(value);
  if (raw == null) return "";
  if (raw instanceof Date) return isoDate(raw);
  if (typeof raw === "number") {
    if (date) return excelSerial(raw);
    if (Number.isInteger(raw)) return String(raw);
    return String(raw);
  }
  if (typeof raw === "boolean") return raw ? "true" : "";
  return String(raw).trim();
}

function unwrap(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("result" in value) return unwrap(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
  }
  return value;
}

function isoDate(value: Date): string {
  if (Number.isNaN(value.getTime())) return "";
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(value.getUTCDate()).padStart(2, "0");
  return `${value.getUTCFullYear()}-${month}-${dayOfMonth}`;
}

function excelSerial(value: number): string {
  const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  return isoDate(date);
}
