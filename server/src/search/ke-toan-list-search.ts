import type { ListSearch } from "@speego/shared";
import { DateRangeCriterion } from "./date-range-criterion";
import { ExactMatchCriterion } from "./exact-match-criterion";
import { SearchBuilder } from "./search-builder";
import { sql } from "./sql-expression";
import { TextSearchCriterion } from "./text-search-criterion";

export interface PaymentListSearch extends ListSearch {
  status: string;
  payeeKind: string;
  purpose: string;
}

export interface PayrollListSearch extends ListSearch {
  department: string;
}

export interface ExpenseListSearch extends ListSearch {
  department: string;
  status: string;
}

/** Tìm theo mã, đơn hàng, người nhận, mã tham chiếu, tên khách và nội dung thanh toán. */
const paymentTextColumns = [
  sql("d.ma_hien_thi"),
  sql("d.ma_don_hang"),
  sql("d.ma_tham_chieu"),
  sql("d.ma_nguoi_nhan"),
  sql("d.nguoi_nhan"),
  sql("d.ten_khach_hang"),
  sql("d.noi_dung_thanh_toan"),
  sql("d.ghi_chu"),
  sql("d.so_tien::text"),
] as const;

export function paymentSearch(input: PaymentListSearch): SearchBuilder {
  return new SearchBuilder()
    .add(new TextSearchCriterion(input.q, paymentTextColumns))
    .add(new DateRangeCriterion(sql("d.nhap_luc"), input.from, input.to, "timestamp"))
    .add(new ExactMatchCriterion(sql("d.trang_thai::text"), input.status))
    .add(new ExactMatchCriterion(sql("d.doi_tuong_nhan::text"), input.payeeKind))
    .add(new ExactMatchCriterion(sql("d.muc_dich::text"), input.purpose));
}

const payrollTextColumns = [
  sql("l.ma_hien_thi"),
  sql("l.ma_nhan_su"),
  sql("l.ho_ten"),
  sql("l.phong_ban"),
  sql("l.vi_tri"),
] as const;

export function payrollSearch(input: PayrollListSearch): SearchBuilder {
  return new SearchBuilder()
    .add(new TextSearchCriterion(input.q, payrollTextColumns))
    .add(new DateRangeCriterion(sql("l.ky"), input.from, input.to, "date"))
    .add(new ExactMatchCriterion(sql("l.phong_ban"), input.department));
}

const expenseTextColumns = [
  sql("c.ma_hien_thi"),
  sql("c.phong_ban"),
  sql("c.hang_muc"),
  sql("c.noi_dung"),
  sql("c.so_tien::text"),
] as const;

export function expenseSearch(input: ExpenseListSearch): SearchBuilder {
  return new SearchBuilder()
    .add(new TextSearchCriterion(input.q, expenseTextColumns))
    .add(new DateRangeCriterion(sql("c.ngay_chi"), input.from, input.to, "date"))
    .add(new ExactMatchCriterion(sql("c.phong_ban"), input.department))
    .add(new ExactMatchCriterion(sql("c.trang_thai::text"), input.status));
}
