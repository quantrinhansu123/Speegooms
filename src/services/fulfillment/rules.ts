import { inStockStatuses, inboundAlertDays } from "../../config/fulfillment.ts";
import type { Delivery, FulfillmentSnapshot, InboundReceipt, Outbound, Package } from "@/types/fulfillment";

/** Quy tắc nghiệp vụ Fulfillment thuần. Kiểm tra bằng pnpm check:fulfillment. */

const DAY = 864e5;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

export const isInStock = (p: Package) => inStockStatuses.includes(p.status);

/** Hàng đã về kho đích nhưng chưa nhập kho quá số ngày cấu hình. */
export const inboundDelayDays = (r: InboundReceipt, today: string) => (r.status === "cho-nhap" ? Math.max(0, daysBetween(r.arrivedOn, today)) : 0);
export const isInboundLate = (r: InboundReceipt, today: string) => inboundDelayDays(r, today) > inboundAlertDays;

/** Kiểm đếm xong thì sinh trạng thái nhập: lệch số lượng phải ghi chú. */
export function receiptOutcome(expected: number, received: number, note: string): { ok: true; status: "da-nhap" | "lech" } | { ok: false; error: string } {
  if (!Number.isFinite(received) || received < 0) return { ok: false, error: "Số lượng nhận không hợp lệ" };
  if (received === expected) return { ok: true, status: "da-nhap" };
  if (!note.trim()) return { ok: false, error: `Số nhận (${received}) khác số dự kiến (${expected}), cần ghi chú lý do` };
  return { ok: true, status: "lech" };
}

/** Chỉ tạo lệnh pick khi mọi kiện của đơn đang trong kho và đơn chưa có lệnh xuất. */
export function canCreateOutbound(orderId: string, snap: Pick<FulfillmentSnapshot, "packages" | "outbounds">): { ok: boolean; reason?: string } {
  const pkgs = snap.packages.filter((p) => p.orderId === orderId);
  if (pkgs.length === 0) return { ok: false, reason: "Đơn chưa có kiện nào trong kho (chưa nhập kho)" };
  if (snap.outbounds.some((o) => o.orderId === orderId)) return { ok: false, reason: "Đơn đã có lệnh pick/pack" };
  if (pkgs.some((p) => p.status !== "trong-kho")) return { ok: false, reason: "Có kiện không ở trạng thái Trong kho" };
  return { ok: true };
}

export const allPicked = (o: Outbound) => o.packageIds.every((id) => o.pickedIds.includes(id));

export function packBlockReason(o: Outbound): string | undefined {
  if (o.status === "da-dong-goi" || o.status === "da-xuat") return "Lệnh đã đóng gói";
  if (!allPicked(o)) return "Cần pick đủ mọi kiện trước khi đóng gói";
  return undefined;
}

export function podOutcome(receivedBy: string, note: string): { ok: boolean; error?: string } {
  if (!receivedBy.trim()) return { ok: false, error: "Nhập tên người nhận để xác nhận giao hàng (POD)" };
  if (!note.trim()) return { ok: false, error: "Nhập ghi chú giao nhận (tình trạng hàng khi giao)" };
  return { ok: true };
}

export const isDeliveryOpen = (d: Delivery) => d.status === "dang-giao" || d.status === "giao-that-bai";

export const nextSeq = (prefix: string, ids: string[], width: number) => {
  const max = ids.reduce((m, id) => {
    const n = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN;
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
};
