import { enforceProfileForHot, leadProfileFields, simulatedApprovals } from "../../config/crm.ts";
import type {
  Contract,
  Customer,
  GoodsOrigin,
  Lead,
  Quotation,
  QuoteLine,
  RouteCode,
  Staff,
} from "@/types/crm";

/** Quy tắc nghiệp vụ thuần (không phụ thuộc UI/store) để dễ kiểm thử và thay bằng API sau này. */

/** Cột "Xuất xứ hàng" quyết định phòng: xưởng VN → Sale Việt Nam, xưởng TQ → Sale Global. */
export const routeFromOrigin = (origin: GoodsOrigin): RouteCode | null =>
  origin === "vn" ? "vn" : origin === "cn" ? "global" : null;

export const teamOfRoute = (route: RouteCode) => (route === "vn" ? "sale-vn" : "sale-global");

export const staffOfRoute = (staff: Staff[], route: RouteCode) => staff.filter((s) => s.team === teamOfRoute(route));

const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^A-Za-z0-9]+/g, "");

/** mess_id chỉ cần ngày + tên khách. Trùng thì thêm hậu tố -2, -3... */
export function makeMessId(date: string, contactName: string, existing: Iterable<string>) {
  const base = `MS-${date.replaceAll("-", "")}-${slug(contactName)}`;
  const used = new Set(existing);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Sinh mã kế tiếp theo tiền tố, ví dụ nextId("RFQ-", ids, 4) → "RFQ-0260". */
export function nextId(prefix: string, ids: string[], width: number) {
  const max = ids.reduce((m, id) => {
    const n = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN;
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

export function profileCompleteness(lead: Lead) {
  const missing = leadProfileFields.filter((f) => !lead.profile[f.id]?.value?.trim());
  return { filled: leadProfileFields.length - missing.length, total: leadProfileFields.length, missing };
}

/** Tài liệu: đủ 6 thông tin mới sang Hot. Tiêu chí chi tiết chưa duyệt nên chỉ dựa trên cấu hình. */
export function canMoveToHot(lead: Lead): { ok: boolean; reason?: string } {
  const { missing } = profileCompleteness(lead);
  if (enforceProfileForHot && missing.length > 0) {
    return { ok: false, reason: `Còn thiếu ${missing.length} thông tin: ${missing.map((m) => m.label).join(", ")}` };
  }
  return { ok: true };
}

const normalizeName = (name: string) =>
  slug(name.toLowerCase().replace(/công ty|tnhh|co\.?,? ?ltd|llc|jsc|cổ phần/g, "")).toLowerCase();
const normalizePhone = (p: string) => p.replace(/\D/g, "");

export interface DuplicateGroup {
  reason: string;
  customers: Customer[];
}

/** Cảnh báo trùng DEMO: so khớp số điện thoại, email hoặc tên đã chuẩn hóa. Chỉ gợi ý, không tự gộp. */
export function findDuplicateGroups(customers: Customer[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const by = (reason: string, key: (c: Customer) => string) => {
    const map = new Map<string, Customer[]>();
    for (const c of customers) {
      const k = key(c);
      if (k) map.set(k, [...(map.get(k) ?? []), c]);
    }
    for (const list of map.values()) if (list.length > 1) groups.push({ reason, customers: list });
  };
  by("Trùng số điện thoại", (c) => normalizePhone(c.phone));
  by("Trùng email", (c) => c.email.toLowerCase());
  by("Tên gần giống nhau", (c) => normalizeName(c.name));
  // Gộp các nhóm cùng tập khách để không báo lặp
  const seen = new Set<string>();
  return groups.filter((g) => {
    const key = g.customers.map((c) => c.customerId).sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const findDuplicatesFor = (customers: Customer[], input: { phone?: string; email?: string; name?: string }) =>
  customers.filter(
    (c) =>
      (input.phone && normalizePhone(input.phone).length >= 8 && normalizePhone(c.phone) === normalizePhone(input.phone)) ||
      (input.email && c.email.toLowerCase() === input.email.toLowerCase()) ||
      (input.name && normalizeName(input.name).length > 3 && normalizeName(c.name) === normalizeName(input.name)),
  );

// ---- Báo giá
const sum = (lines: QuoteLine[], pick: (l: QuoteLine) => number) => lines.reduce((s, l) => s + pick(l), 0);

export function quoteTotals(q: Pick<Quotation, "goods" | "freight" | "surcharges" | "discountPercent">) {
  const goods = sum(q.goods, (l) => l.quantity * l.unitPrice);
  const freight = sum(q.freight, (l) => l.quantity * l.unitPrice);
  const surcharges = sum(q.surcharges, (l) => l.quantity * l.unitPrice);
  const subtotal = goods + freight + surcharges;
  const discount = Math.round((subtotal * q.discountPercent) / 100);
  const total = subtotal - discount;
  const all = [...q.goods, ...q.freight, ...q.surcharges];
  const cost = sum(all, (l) => l.quantity * (l.costPrice ?? l.unitPrice));
  return { goods, freight, surcharges, subtotal, discount, total, cost, margin: total - cost };
}

/** CHỈ MÔ PHỎNG ngưỡng A: giảm giá vượt ngưỡng cần Trưởng phòng Sale duyệt. */
export const quoteNeedsApproval = (q: Pick<Quotation, "discountPercent">) =>
  q.discountPercent > simulatedApprovals.quoteDiscountPercent;

// ---- Hợp đồng / cọc
/** CHỈ MÔ PHỎNG ngưỡng B: hợp đồng giá trị lớn cần Ban GĐ duyệt. */
export const contractNeedsBoard = (value: number) => value > simulatedApprovals.contractBoardVnd;

export const canRequestDeposit = (c: Contract) =>
  c.status === "da-ky" &&
  (c.deposit.status === "chua-yeu-cau" || c.deposit.status === "khong-khop") &&
  (c.boardApproval === "khong-can" || c.boardApproval === "da-duyet");

/** Không đặt xưởng / bàn giao Vận hành khi chưa "Đã cọc" (chỉ Kế toán xác nhận). */
export const canHandOver = (c: Contract) =>
  c.status === "da-ky" && c.deposit.status === "da-coc" && c.handover.status === "chua";

export const isDepositConfirmed = (c: Contract) => c.deposit.status === "da-coc";
