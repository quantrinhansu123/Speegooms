/**
 * Khách Sourcing luồng kết hợp: Sale báo giá chuyển cho Sourcing trước.
 * Bàn Logistics chỉ có bản ghi khi Sourcing đã chuyển sang:
 *  - Sourcing đã gửi báo giá (lúc gửi cũng chuyển cho Logistics), hoặc
 *  - Sourcing bấm "Gửi qua Logistics" (có dấu handoffAt), hoặc
 *  - phiếu Logistics đã có nội dung (đơn hàng, báo giá đã gửi, trạng thái khác mặc định).
 * Phiếu rỗng tạo sẵn lúc Sale yêu cầu báo giá không tính là đã chuyển.
 */
export const LOGISTICS_HANDED_OFF_SQL = `(
  q.ban_da_gui is not null
  or (q.bao_gia_logistics is not null and (
    q.bao_gia_logistics->>'handoffAt' is not null
    or (jsonb_typeof(q.bao_gia_logistics->'orders') = 'array' and q.bao_gia_logistics->'orders' <> '[]'::jsonb)
    or q.bao_gia_logistics->>'sentQuote' is not null
    or coalesce(q.bao_gia_logistics->>'quoteStatus', 'CHUA_CO_BAO_GIA') <> 'CHUA_CO_BAO_GIA'
  ))
)`;

/** Khách Sourcing kết hợp đã chuyển sang Logistics: dùng trong WHERE cùng bí danh bảng như quoteSelect (l, q). */
export const COMBINED_HANDED_OFF_SQL = `(l.nhom_khach::text = 'SOURCING' and l.luong_bao_gia = 'COMBINED') and ${LOGISTICS_HANDED_OFF_SQL}`;

/** Phiếu Logistics còn trống: chưa có đơn hàng và chưa gửi báo giá, nên được bù đơn hàng từ Sourcing. */
export const LOGISTICS_SHEET_UNSEEDED_SQL = `coalesce(bao_gia_logistics->'orders', '[]'::jsonb) = '[]'::jsonb and bao_gia_logistics->>'sentQuote' is null`;

/**
 * Giá trị mới của cột bao_gia_logistics khi Sourcing chuyển sang: tạo phiếu từ `param` nếu chưa có,
 * bù đơn hàng khi phiếu còn trống (và `seedWhen` đúng), luôn đóng dấu handoffAt.
 */
export function mergeHandoffSql(param: string, seedWhen = "true"): string {
  return `jsonb_set(case when bao_gia_logistics is null then ${param}::jsonb
    when ${seedWhen} and ${LOGISTICS_SHEET_UNSEEDED_SQL}
      then jsonb_set(bao_gia_logistics, '{orders}', ${param}::jsonb->'orders')
    else bao_gia_logistics end, '{handoffAt}', coalesce(bao_gia_logistics->'handoffAt', ${param}::jsonb->'handoffAt'))`;
}

/** Bản TypeScript của LOGISTICS_HANDED_OFF_SQL, dùng khi đã có dữ liệu hàng trong tay. */
export function isLogisticsHandedOff(sheet: unknown, sentCopy: unknown): boolean {
  if (sentCopy != null) return true;
  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) return false;
  const row = sheet as Record<string, unknown>;
  if (row.handoffAt != null) return true;
  if (Array.isArray(row.orders) && row.orders.length > 0) return true;
  if (row.sentQuote != null) return true;
  const status = typeof row.quoteStatus === "string" && row.quoteStatus ? row.quoteStatus : "CHUA_CO_BAO_GIA";
  return status !== "CHUA_CO_BAO_GIA";
}
