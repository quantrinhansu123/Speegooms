import type { ListSearch } from "@speego/shared";
import { DateRangeCriterion } from "./date-range-criterion";
import { ExactMatchCriterion } from "./exact-match-criterion";
import { SearchBuilder } from "./search-builder";
import { sql, type SqlExpression } from "./sql-expression";
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
}

export interface QuoteListSearch extends ListSearch {
  quoteStatus: string;
  contractStatus: string;
  customerKind: string;
}

export interface ContractListSearch extends ListSearch {
  opsStatus: string;
  accountingStatus: string;
}

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
    .add(new ExactMatchCriterion(sql("l.loai_khach_hang::text"), input.customerType));
}

export function quoteSearch(input: QuoteListSearch, statusColumn: SqlExpression, contractColumn: SqlExpression): SearchBuilder {
  return new SearchBuilder()
    .add(new TextSearchCriterion(input.q, quoteTextColumns))
    .add(new DateRangeCriterion(sql("q.tao_luc"), input.from, input.to, "timestamp"))
    .add(new ExactMatchCriterion(statusColumn, input.quoteStatus))
    .add(new ExactMatchCriterion(contractColumn, input.contractStatus))
    .add(new ExactMatchCriterion(sql("l.nhom_khach::text"), input.customerKind));
}

export function contractSearch(view: "sale" | "ops" | "accounting", input: ContractListSearch): SearchBuilder {
  const textColumns = view === "sale"
    ? [sql("h.ma_hien_thi"), sql("h.ma_bao_gia_hien_thi"), sql("h.ten_khach_hang"), sql("h.san_pham"), sql("h.trang_thai_van_hanh")]
    : view === "ops"
      ? [sql("h.ma_hien_thi"), sql("h.ma_bao_gia_hien_thi"), sql("ban_gui_van_hanh->>'customerName'"), sql("ban_gui_van_hanh->>'product'"), sql("h.tracking"), sql("h.trang_thai_van_hanh")]
      : [sql("h.ma_hien_thi"), sql("h.ma_bao_gia_hien_thi"), sql("ban_gui_ke_toan->>'customerName'"), sql("ban_gui_ke_toan->>'product'"), sql("ban_gui_ke_toan->>'tracking'"), sql("h.trang_thai_van_hanh")];
  const signedOn = view === "sale"
    ? sql("h.ngay_ky")
    : view === "ops"
      ? sql("(ban_gui_van_hanh->>'signedOn')::date")
      : sql("(ban_gui_ke_toan->>'signedOn')::date");
  const accountingStatus = view === "accounting"
    ? sql("h.trang_thai_ke_toan::text")
    : sql("ban_gui_xac_nhan->>'accountingStatus'");
  return new SearchBuilder()
    .add(new TextSearchCriterion(input.q, textColumns))
    .add(new DateRangeCriterion(signedOn, input.from, input.to, "date"))
    .add(new ExactMatchCriterion(sql("h.trang_thai_van_hanh"), input.opsStatus))
    .add(new ExactMatchCriterion(accountingStatus, input.accountingStatus));
}
