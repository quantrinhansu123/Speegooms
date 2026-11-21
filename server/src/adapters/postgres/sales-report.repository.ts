import {
  contractVndSummary, salesReportDepartments, salesReportPeriods,
  type CrmLane, type PublicUser, type SalesMetrics, type SalesProcessingCounts,
  type SalesReportMember, type SalesReportQuery,
} from "@speego/shared";
import type pg from "pg";
import { amountsFromRow } from "./crm.repository";
import { contractOwnerSql, crmTables, leadOwnerSql } from "./crm-sale-scope";

const departmentByLane = { vn: "sale-vn", global: "sale-global" } as const;
const teamRoles = { vn: ["sale-vn"], global: ["sale-global", "sale-global-lead"] };
const allTeamRoles = [...teamRoles.vn, ...teamRoles.global];

// Resolve old imports by name only when it identifies a single Sale in this lane.
const ownerTable = `with staff as (
  select ma_nguoi_dung as id, lower(btrim(ho_ten)) as name from public.nguoi_dung where vai_tro = any($1::text[])
), staff_names as (
  select name, min(id) as id from staff where name <> '' group by name having count(*) = 1
)`;
const staffId = (id: string) => `(select id from staff where id = ${id})`;
const owner = (id: string, name: string) => `coalesce(
  ${staffId(id)},
  (select id from staff_names where name = lower(btrim(${name})))
)`;
const messOwner = `coalesce(${owner("l.nguoi_xu_ly_id", "m.nhan_vien_ban")}, ${staffId("m.nguoi_tao_id")})`;
const messActivityDate = `(coalesce(m.nhan_luc, m.tao_luc) at time zone 'Asia/Ho_Chi_Minh')::date`;
const emptyMetrics = (): SalesMetrics => ({ selfSourced: 0, potentials: 0, quoted: 0, closed: 0, revenue: 0, missingRates: 0 });

export class PostgresSalesReportRepository {
  constructor(private readonly pool: pg.Pool) {}

  async read(actor: PublicUser, query: SalesReportQuery) {
    const staff = (await this.pool.query<SalesReportMember>(
      `select ma_nguoi_dung as id, ho_ten as name,
        case when vai_tro = 'sale-vn' then 'sale-vn' else 'sale-global' end as department
       from public.nguoi_dung where vai_tro = any($1::text[]) order by ho_ten, ma_nguoi_dung`,
      [allTeamRoles],
    )).rows;
    const lanes: CrmLane[] = actor.role === "sale-vn" ? ["vn"]
      : actor.role === "sale-global" || actor.role === "sale-global-lead" ? ["global"] : ["vn", "global"];
    const ownOnly = actor.role === "sale-vn" || actor.role === "sale-global";
    const departments = lanes.map((lane) => departmentByLane[lane]);
    const members = staff.filter((member) => departments.includes(member.department) && (!ownOnly || member.id === actor.id));

    if (query.view === "processing") {
      const groups = await Promise.all(lanes.map((lane) => this.processing(lane, members.filter((member) => member.department === departmentByLane[lane]))));
      const counts: Record<string, SalesProcessingCounts> = Object.fromEntries(members.map(({ id }) => [id, {}]));
      for (const row of groups.flat()) counts[row.id]![row.status] = row.count;
      return { members, counts };
    }

    const { previous, current } = salesReportPeriods(query.view, query.date);
    const totals = new Map(members.map(({ id }) => [id, { id, current: emptyMetrics(), previous: emptyMetrics() }]));
    const groups = await Promise.all(lanes.map((lane) => this.performance(
      lane, members.filter((member) => member.department === departmentByLane[lane]), previous.start, current.start, current.end,
    )));
    for (const [counts, revenue] of groups) {
      for (const { id, isCurrent, selfSourced, potentials, quoted, closed } of counts) {
        Object.assign(totals.get(id)![isCurrent ? "current" : "previous"], { selfSourced, potentials, quoted, closed });
      }
      for (const { id, isCurrent, ...contract } of revenue) {
        const result = totals.get(id)![isCurrent ? "current" : "previous"];
        const total = contractVndSummary(amountsFromRow(contract), [], contract.currency).total;
        if (total == null) result.missingRates++;
        else result.revenue += total;
      }
    }
    const headcounts = Object.fromEntries(salesReportDepartments.map((department) => [
      department, departments.includes(department) ? staff.filter((member) => member.department === department).length : 0,
    ])) as Record<SalesReportMember["department"], number>;
    return { members, headcounts, rows: [...totals.values()] };
  }

  private async processing(lane: CrmLane, members: SalesReportMember[]) {
    if (!members.length) return [];
    const { message, potential } = crmTables[lane];
    return (await this.pool.query<{ id: string; status: keyof SalesProcessingCounts; count: number }>(`${ownerTable}, mess as (
      select ${messOwner} as id, m.trang_thai_xu_ly as status
      from ${message} m left join ${potential} l on l.ma_tin_nhan = m.id and l.xoa_luc is null
    ) select id, status, count(*)::int as count from mess where id = any($2::text[]) group by id, status`,
    [teamRoles[lane], members.map(({ id }) => id)])).rows;
  }

  private async performance(lane: CrmLane, members: SalesReportMember[], from: string, split: string, to: string) {
    const tables = crmTables[lane];
    const { message, potential, sourcing, logistics } = tables;
    const values = [teamRoles[lane], members.map(({ id }) => id), from, split, to, lane];
    const messJoin = `left join ${potential} l on l.ma_tin_nhan = m.id and l.xoa_luc is null`;
    const results = await Promise.all([
      this.pool.query<Omit<SalesMetrics, "revenue" | "missingRates"> & { id: string; isCurrent: boolean }>(`${ownerTable},
      self_sourced as (
        select ${messOwner} as id, ${messActivityDate} >= $4::date as current_period
        from ${message} m ${messJoin}
        where (m.thuong_hieu = 'SELF_SOURCED' or l.thuong_hieu = 'SELF_SOURCED')
          and ${messActivityDate} >= $3::date and ${messActivityDate} < $5::date
        union all
        select ${staffId(leadOwnerSql("l"))}, l.tao_luc >= ($4::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
        from ${potential} l where l.ma_tin_nhan is null and l.xoa_luc is null and l.thuong_hieu = 'SELF_SOURCED'
          and l.tao_luc >= ($3::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
          and l.tao_luc < ($5::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
      ), lead_cohort as (
        select l.id as lead_id, ${owner(leadOwnerSql("l"), "m.nhan_vien_ban")} as id,
          l.tao_luc >= ($4::date::timestamp at time zone 'Asia/Ho_Chi_Minh') as current_period
        from ${potential} l left join ${message} m on m.id = l.ma_tin_nhan
        where l.xoa_luc is null and l.tiem_nang is not null
          and l.tao_luc >= ($3::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
          and l.tao_luc < ($5::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
      ), lead_results as (
        select l.id, current_period,
          bool_or(q.sent or h.id is not null) as quoted, bool_or(h.id is not null) as closed
        from lead_cohort l
        cross join lateral (select case when current_period then $5::date else $4::date end as end_date) p
        cross join lateral (select to_char(p.end_date::timestamp - interval '7 hours', 'YYYY-MM-DD"T"HH24:MI:SS') as end_utc) boundary
        left join lateral (
          select s.id, coalesce(nullif(s.ban_da_gui->>'sentAt', '') < boundary.end_utc, false)
            or coalesce(nullif(s.bao_gia_logistics->'sentQuote'->>'sentAt', '') < boundary.end_utc, false) as sent
          from ${sourcing} s where s.ma_khach_hang_tiem_nang = l.lead_id
          union all
          select q.id, coalesce(nullif(q.ban_da_gui->>'sentAt', '') < boundary.end_utc, false)
          from ${logistics} q where q.ma_khach_hang_tiem_nang = l.lead_id
        ) q on true
        left join crm.hop_dong h on h.ma_bao_gia = q.id and h.tuyen = $6 and h.ngay_ky < p.end_date
        where l.id = any($2::text[])
        group by l.lead_id, l.id, current_period
      ), activity as (
        select id, current_period, true as self_sourced, false as quoted, false as closed from self_sourced where id = any($2::text[])
        union all select id, current_period, false, quoted, closed from lead_results
      )
      select id, current_period as "isCurrent", count(*) filter (where self_sourced)::int as "selfSourced",
        count(*) filter (where not self_sourced)::int as potentials,
        count(*) filter (where quoted)::int as quoted, count(*) filter (where closed)::int as closed
      from activity group by id, current_period`, values),
      this.pool.query<Parameters<typeof amountsFromRow>[0] & { id: string; isCurrent: boolean }>(`${ownerTable}, contracts as (
        select ${owner(contractOwnerSql(tables, "h"), "h.nhan_vien_ban")} as id, h.ngay_ky >= $4::date as "isCurrent",
          h.loai_tien as currency, h.loai_tien_van_chuyen as shipping_currency,
          h.gia_tri_san_pham as product_value, h.chi_phi_van_chuyen as shipping_cost, h.khoan_tien as amounts_body
        from crm.hop_dong h where h.tuyen = $6 and h.ngay_ky >= $3::date and h.ngay_ky < $5::date
      ) select * from contracts where id = any($2::text[])`, values),
    ]);
    return [results[0].rows, results[1].rows] as const;
  }
}
