import { crmActor } from "../../lib/crm-actor";

type QuoteTables = { potential: string; sourcing: string; logistics: string };

export const crmTables = {
  vn: {
    message: "crm.tin_nhan_viet_nam",
    potential: "crm.khach_hang_tiem_nang_viet_nam",
    sourcing: "crm.bao_gia_sourcing_viet_nam",
    logistics: "crm.bao_gia_logistics_viet_nam",
  },
  global: {
    message: "crm.tin_nhan_global",
    potential: "crm.khach_hang_tiem_nang_global",
    sourcing: "crm.bao_gia_sourcing_global",
    logistics: "crm.bao_gia_logistics_global",
  },
} as const;

export function saleOwnerId(): string | undefined {
  const actor = crmActor.getStore();
  return actor?.role === "sale-vn" || actor?.role === "sale-global" ? actor.id : undefined;
}

export function leadOwnerSql(alias: string): string {
  return `coalesce(${alias}.nguoi_xu_ly_id, ${alias}.nguoi_tao_id)`;
}

export function saleScope(values: unknown[], predicate: (parameter: string) => string): string {
  const ownerId = saleOwnerId();
  return ownerId ? ` and ${predicate(`$${values.push(ownerId)}`)}` : "";
}

export function leadSaleScope(values: unknown[], alias = "l"): string {
  return saleScope(values, (owner) => `${leadOwnerSql(alias)} = ${owner}`);
}

export function quoteSaleScope(tables: QuoteTables, values: unknown[], alias = "q"): string {
  return saleScope(values, (owner) => `exists (select 1 from ${tables.potential} l
    where l.id = ${alias}.ma_khach_hang_tiem_nang and l.xoa_luc is null and ${leadOwnerSql("l")} = ${owner})`);
}

export function quoteOwnerSql(tables: QuoteTables, quoteId: string, activeLeadOnly: boolean): string {
  return `(
    select ${leadOwnerSql("owner_lead")} from ${tables.potential} owner_lead
    where owner_lead.id = coalesce(
      (select q.ma_khach_hang_tiem_nang from ${tables.sourcing} q where q.id = ${quoteId}),
      (select q.ma_khach_hang_tiem_nang from ${tables.logistics} q where q.id = ${quoteId})
    )${activeLeadOnly ? " and owner_lead.xoa_luc is null" : ""}
  )`;
}

export function contractOwnerSql(tables: QuoteTables, alias: string): string {
  return `(case when ${alias}.ma_bao_gia is null then ${alias}.nguoi_tao_id else ${quoteOwnerSql(tables, `${alias}.ma_bao_gia`, false)} end)`;
}

export function contractSaleScope(tables: QuoteTables, values: unknown[], alias = "h"): string {
  return saleScope(values, (owner) => `${contractOwnerSql(tables, alias)} = ${owner}`);
}
