import type { CrmSnapshot, CrmSnapshotDto } from "@/types/crm";

/**
 * API adapter: DTO (snake_case, khớp backend/tài liệu) <-> model miền (camelCase).
 * Hiện chỉ đổi kiểu khóa vì mock cùng cấu trúc; khi backend khác tên trường/enum, sửa ở đây
 * để UI và store không phải đổi.
 */
const toCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function mapKeys(value: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), mapKeys(v, fn)]));
  }
  return value;
}

/** Dùng chung cho mọi module có DTO snake_case (CRM, Vận hành...). */
export const camelizeKeys = <T>(dto: unknown) => mapKeys(dto, toCamel) as T;
export const snakeizeKeys = <T>(model: unknown) => mapKeys(model, toSnake) as T;

export const snapshotFromDto = (dto: CrmSnapshotDto) => camelizeKeys<CrmSnapshot>(dto);
export const snapshotToDto = (snapshot: CrmSnapshot) => snakeizeKeys<CrmSnapshotDto>(snapshot);
