import type { ListSearch } from "@speego/shared";
import { AnyMatchCriterion } from "./any-match-criterion";
import { DateRangeCriterion } from "./date-range-criterion";
import { ExactMatchCriterion } from "./exact-match-criterion";
import { SearchBuilder } from "./search-builder";
import { sql, trustedSql, type SqlExpression } from "./sql-expression";
import { TextSearchCriterion } from "./text-search-criterion";

export interface MessageListSearch extends ListSearch {
  status: string;
  classification: string;
  demand: string;
  customerType: string;
}

export interface PotentialListSearch extends ListSearch {
  source: string;
  potential: string;
  customerKind: string;
  customerType: string;
  /** Chỉ dùng nội bộ (trang theo dõi), không đọc từ query string. */
  potentialIds?: readonly string[];
  /** ACL nhóm khách theo role (null = mọi nhóm). Không đọc từ query string. */
  allowedKinds?: readonly string[] | null;
}

export interface QuoteListSearch extends ListSearch {
  quoteStatus: string;
  contractStatus: string;
  customerKind: string;
  /** Chỉ dùng nội bộ (trang theo dõi), không đọc từ query string. */
  potentialIds?: readonly string[];
}

export interface ContractListSearch extends ListSearch {
  opsStatus: string;
  accountingStatus: string;
  /** Chỉ dùng nội bộ (trang theo dõi), không đọc từ query string. */
  quoteIds?: readonly string[];
}

export const emptyListSearch: ListSearch = { q: "", from: "", to: "" };

const quoteTextColumns = [
  sql("q.ma_hien_thi"),
  sql("l.ma_tiem_nang"),
  sql("l.ho_ten"),
  sql("l.ten_cong_ty"),
  sql("l.san_pham_quan_tam"),
  sql("m.ten"),
] as const;

export function messageSearch(input: MessageListSearch): SearchBuilder {
  return new SearchBuilder()
    .add(new TextSearchCriterion(input.q, [
      sql("m.ma_hien_thi"),
      sql("m.ten_khach_hang_tho"),
      sql("m.hang_hoa"),
      sql("m.thi_truong"),
      sql("m.nhan_vien_ban"),
      sql("m.ghi_chu"),
      sql("m.ghi_chu_van_de"),
      sql("m.link_mess"),
    ]))
    .add(new DateRangeCriterion(sql("m.nhan_luc"), input.from, input.to, "timestamp"))
    .add(new ExactMatchCriterion(sql("m.trang_thai::text"), input.status))
    .add(new ExactMatchCriterion(sql("m.phan_loai::text"), input.classification))
    .add(new ExactMatchCriterion(sql("m.nhu_cau::text"), input.demand))
    .add(new ExactMatchCriterion(sql("m.loai_khach_hang::text"), input.customerType));
}

export function potentialSearch(input: PotentialListSearch): SearchBuilder {
  return new SearchBuilder()
    .add(new TextSearchCriterion(input.q, [
      sql("l.ma_tiem_nang"),
      sql("m.ma_hien_thi"),
      sql("l.ho_ten"),
      sql("l.ten_cong_ty"),
      sql("l.so_dien_thoai"),
      sql("l.thu_dien_tu"),
      sql("l.san_pham_quan_tam"),
      sql("l.dia_chi"),
      sql("l.ghi_chu_ban_hang"),
    ]))
    .add(new DateRangeCriterion(sql("l.tao_luc"), input.from, input.to, "timestamp"))
    .add(new ExactMatchCriterion(sql("l.nguon::text"), input.source))
    .add(new ExactMatchCriterion(sql("l.tiem_nang::text"), input.potential))
    .add(new ExactMatchCriterion(sql("l.nhom_khach::text"), input.customerKind))
    .add(new ExactMatchCriterion(sql("l.loai_khach_hang::text"), input.customerType))
    .add(new AnyMatchCriterion(sql("l.id"), input.potentialIds, "uuid"))
    .add(new AnyMatchCriterion(sql("l.nhom_khach::text"), input.allowedKinds === null ? undefined : input.allowedKinds));
}

export function quoteSearch(input: QuoteListSearch, statusColumn: SqlExpression, contractColumn: SqlExpression): SearchBuilder {
  return new SearchBuilder()
    .add(new TextSearchCriterion(input.q, quoteTextColumns))
    .add(new DateRangeCriterion(sql("q.tao_luc"), input.from, input.to, "timestamp"))
    .add(new ExactMatchCriterion(statusColumn, input.quoteStatus))
    .add(new ExactMatchCriterion(contractColumn, input.contractStatus))
    .add(new ExactMatchCriterion(sql("l.nhom_khach::text"), input.customerKind))
    .add(new AnyMatchCriterion(sql("q.ma_khach_hang_tiem_nang"), input.potentialIds, "uuid"));
}

const accountingStatusLabelSql = trustedSql(`case coalesce(h.trang_thai_ke_toan::text, ban_gui_xac_nhan->>'accountingStatus', '')
  when 'DA_HOAN_THANH_COC' then 'Đã hoàn thành cọc'
  when 'DA_HOAN_THANH_THANH_TOAN' then 'Đã hoàn thành thanh toán'
  when 'CHUA_HOAN_THANH_COC' then 'Chưa hoàn thành cọc'
  when 'CHUA_HOAN_THANH_THANH_TOAN' then 'Chưa hoàn thành thanh toán'
  else coalesce(h.trang_thai_ke_toan::text, ban_gui_xac_nhan->>'accountingStatus', '')
end`);

/** Tìm trên mọi trạng thái và hầu hết trường hiển thị của hợp đồng. */
const contractTextColumns = [
  sql("h.ma_hien_thi"),
  sql("h.ma_bao_gia_hien_thi"),
  sql("h.ten_khach_hang"),
  sql("h.nhan_vien_ban"),
  sql("h.van_chuyen_den"),
  sql("h.san_pham"),
  sql("h.so_luong::text"),
  sql("h.loai_tien"),
  sql("h.gia_tri_san_pham::text"),
  sql("h.chi_phi_van_chuyen::text"),
  sql("h.tong_gia_tri::text"),
  sql("h.so_tien_thanh_toan::text"),
  sql("h.so_tien_con_lai::text"),
  sql("h.so_tien_xac_nhan::text"),
  sql("h.ngay_ky::text"),
  sql("h.trang_thai_van_hanh"),
  sql("h.tracking"),
  sql("h.ghi_chu_1"),
  sql("h.ghi_chu_2"),
  sql("h.ngay_nhap_kho_tq::text"),
  sql("h.ngay_xuat_container::text"),
  sql("h.ngay_cap_cang::text"),
  sql("h.ngay_giao_du_kien::text"),
  sql("h.trang_thai_ke_toan::text"),
  accountingStatusLabelSql,
  sql("ban_gui_van_hanh->>'customerName'"),
  sql("ban_gui_van_hanh->>'saleName'"),
  sql("ban_gui_van_hanh->>'shipTo'"),
  sql("ban_gui_van_hanh->>'product'"),
  sql("ban_gui_van_hanh->>'opsStatus'"),
  sql("ban_gui_ke_toan->>'customerName'"),
  sql("ban_gui_ke_toan->>'saleName'"),
  sql("ban_gui_ke_toan->>'shipTo'"),
  sql("ban_gui_ke_toan->>'product'"),
  sql("ban_gui_ke_toan->>'tracking'"),
  sql("ban_gui_ke_toan->>'note1'"),
  sql("ban_gui_ke_toan->>'note2'"),
  sql("ban_gui_ke_toan->>'opsStatus'"),
  sql("ban_gui_xac_nhan->>'accountingStatus'"),
] as const;

export function contractSearch(view: "sale" | "ops" | "accounting", input: ContractListSearch): SearchBuilder {
  const signedOn = view === "sale"
    ? sql("h.ngay_ky")
    : view === "ops"
      ? sql("(ban_gui_van_hanh->>'signedOn')::date")
      : sql("(ban_gui_ke_toan->>'signedOn')::date");
  const accountingStatus = view === "accounting"
    ? sql("h.trang_thai_ke_toan::text")
    : sql("ban_gui_xac_nhan->>'accountingStatus'");
  return new SearchBuilder()
    .add(new TextSearchCriterion(input.q, contractTextColumns))
    .add(new DateRangeCriterion(signedOn, input.from, input.to, "date"))
    .add(new ExactMatchCriterion(sql("h.trang_thai_van_hanh"), input.opsStatus))
    .add(new ExactMatchCriterion(accountingStatus, input.accountingStatus))
    .add(new AnyMatchCriterion(sql("h.ma_bao_gia"), input.quoteIds, "uuid"));
}
