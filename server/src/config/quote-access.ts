import type { QuoteDesk, Role } from "@speego/shared";

/** Nhóm khách trên tiềm năng / báo giá. */
export type QuoteCustomerKind = "SOURCING" | "LOGISTICS" | "SOURCING_LOGISTICS" | string | null;

/** Role được mở API bàn báo giá (kể cả chỉ xem). */
export function canAccessQuoteDesk(role: Role, desk: QuoteDesk): boolean {
  if (role === "admin" || role === "ban-gd" || role === "van-hanh") return true;
  if (role === "sourcing") return desk === "sourcing";
  if (role === "logistics") return true;
  return false;
}

/** Role được sửa / gửi / quản lý mẫu trên bàn. */
export function canEditQuoteDesk(role: Role, desk: QuoteDesk): boolean {
  if (role === "admin" || role === "van-hanh") return true;
  if (role === "sourcing") return desk === "sourcing";
  if (role === "logistics") return desk === "logistics";
  return false;
}

/**
 * Nhóm khách được liệt kê trên bàn theo role.
 * - `null` = không giới hạn thêm (toàn bộ bản ghi hợp lệ của bàn)
 * - `[]` = không được xem gì trên bàn đó
 */
export function visibleKindsForDesk(role: Role, desk: QuoteDesk): readonly string[] | null {
  if (role === "admin" || role === "ban-gd" || role === "van-hanh") return null;

  if (desk === "sourcing") {
    if (role === "sourcing") return ["SOURCING", "SOURCING_LOGISTICS"];
    if (role === "logistics") return ["SOURCING"];
    return [];
  }

  if (role === "logistics") return ["LOGISTICS", "SOURCING_LOGISTICS"];
  return [];
}

export function canViewQuote(role: Role, desk: QuoteDesk, customerKind: QuoteCustomerKind): boolean {
  if (!canAccessQuoteDesk(role, desk)) return false;
  const kinds = visibleKindsForDesk(role, desk);
  if (kinds === null) return true;
  if (kinds.length === 0) return false;
  return customerKind != null && kinds.includes(customerKind);
}

/** Role nhận thông báo yêu cầu / trả lại báo giá theo bàn + loại khách. */
export function quoteNotifyRoles(desk: QuoteDesk, customerKind?: QuoteCustomerKind): readonly Role[] {
  if (desk === "logistics") return ["logistics", "van-hanh", "admin"];
  if (customerKind === "SOURCING") return ["sourcing", "logistics", "van-hanh", "admin"];
  return ["sourcing", "van-hanh", "admin"];
}
