import type { QuoteDesk } from "./crm";
import type { Role } from "./user";

/** `null` = mọi nhóm khách của bàn; mảng rỗng = không thấy gì. */
type KindScope = readonly string[] | null;

interface DeskPolicy {
  view: Record<QuoteDesk, KindScope>;
  edit: readonly QuoteDesk[];
  /** Nhận thông báo yêu cầu / trả lại báo giá trên các bàn xem được. */
  notify: boolean;
}

const fullView: Record<QuoteDesk, KindScope> = { sourcing: null, logistics: null };

/** Thêm role mới: thêm một dòng tại đây. Role không có dòng thì không vào được bàn báo giá. */
const deskPolicy: Partial<Record<Role, DeskPolicy>> = {
  admin: { view: fullView, edit: ["sourcing", "logistics"], notify: true },
  "ban-gd": { view: fullView, edit: [], notify: false },
  "van-hanh": { view: fullView, edit: ["sourcing", "logistics"], notify: true },
  sourcing: { view: { sourcing: ["SOURCING", "SOURCING_LOGISTICS"], logistics: [] }, edit: ["sourcing"], notify: true },
  logistics: { view: { sourcing: ["SOURCING"], logistics: ["LOGISTICS", "SOURCING_LOGISTICS"] }, edit: ["logistics"], notify: true },
};

export function visibleKindsForDesk(role: Role, desk: QuoteDesk): KindScope {
  const policy = deskPolicy[role];
  return policy ? policy.view[desk] : [];
}

export function canAccessQuoteDesk(role: Role, desk: QuoteDesk): boolean {
  const kinds = visibleKindsForDesk(role, desk);
  return kinds === null || kinds.length > 0;
}

export function canEditQuoteDesk(role: Role, desk: QuoteDesk): boolean {
  return deskPolicy[role]?.edit.includes(desk) ?? false;
}

export function canViewQuote(role: Role, desk: QuoteDesk, customerKind: string | null): boolean {
  const kinds = visibleKindsForDesk(role, desk);
  if (kinds === null) return true;
  return customerKind != null && kinds.includes(customerKind);
}

/**
 * KH tiềm năng theo nhóm khách (menu Sale VN / Sale Global):
 * - Thuần SOURCING: sale + sourcing + logistics (+ admin/VH) đều xem được
 * - Thuần LOGISTICS: sourcing không xem được
 * - SOURCING_LOGISTICS: xem được nếu thấy ít nhất một bàn
 * Role không có desk policy (Sale): `null` = mọi nhóm khách.
 */
export function visibleCustomerKinds(role: Role): readonly string[] | null {
  const policy = deskPolicy[role];
  if (!policy) return null;
  const kinds = new Set<string>();
  for (const desk of Object.keys(policy.view) as QuoteDesk[]) {
    const scope = policy.view[desk];
    if (scope === null) return null;
    for (const kind of scope) kinds.add(kind);
  }
  return [...kinds];
}

export function canViewCustomerKind(role: Role, customerKind: string | null): boolean {
  if (!customerKind) return false;
  const kinds = visibleCustomerKinds(role);
  if (kinds === null) return true;
  return kinds.includes(customerKind);
}

/** Role vận hành nhận thông báo yêu cầu / trả lại báo giá của một bàn. */
export function quoteNotifyRoles(desk: QuoteDesk, customerKind?: string | null): Role[] {
  const kind = customerKind ?? (desk === "logistics" ? "LOGISTICS" : "SOURCING");
  return (Object.keys(deskPolicy) as Role[]).filter((role) => deskPolicy[role]?.notify && canViewQuote(role, desk, kind));
}
