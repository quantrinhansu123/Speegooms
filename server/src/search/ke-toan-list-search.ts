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

export interface LedgerListSearch extends ListSearch {
  kind: string;
  category: string;
  dateField: string;
  counterparty: string;
  receivingAccount?: string;
  internal?: boolean;
  reportMonth?: string;
  customerKey?: string;
}

export const ledgerDateColumn = (dateField: string) => dateField === "transaction" ? "l.ngay_giao_dich" : "l.ngay";
export const ledgerInternalCondition = "l.khoan_muc::text in ('THU_NOI_BO', 'CHI_NOI_BO')";

export function ledgerSearch(input: LedgerListSearch): SearchBuilder {
  const date = ledgerDateColumn(input.dateField);
  const account = input.receivingAccount ?? "";
  const search = new SearchBuilder()
    .add(new TextSearchCriterion(input.q, [sql("l.doi_tuong"), sql("l.ma_don_hang"), sql("h.ten_khach_hang"), sql("l.ma_tham_chieu"), sql("l.tai_khoan_nhan"), sql("l.phong_ban"), sql("l.hang_muc_noi_bo"), sql("l.noi_dung_noi_bo")]))
    .add(new DateRangeCriterion(sql(date), input.from, input.to, "date"))
    .add(new ExactMatchCriterion(sql("l.loai::text"), input.kind))
    .add(new ExactMatchCriterion(sql("l.khoan_muc::text"), input.category))
    .add(new ExactMatchCriterion(sql("l.tai_khoan_nhan"), account.startsWith("name:") ? account.slice(5) : ""))
    .add({ apply: (query) => { // nhiều đối tượng, ngăn cách bằng "|"
      const names = input.counterparty.split("|").map((name) => name.trim().toLowerCase()).filter(Boolean);
      if (names.length) query.where(`lower(l.doi_tuong) = any(${query.param(names)}::text[])`);
    } });
  if (account === "missing") search.add({ apply: (query) => query.where("l.tai_khoan_nhan is null") });
  if (input.internal) search.add({ apply: (query) => query.where(ledgerInternalCondition) });
  if (input.reportMonth === "missing") search.add({ apply: (query) => query.where(`${date} is null`) });
  else if (input.reportMonth) {
    const firstDay = `${input.reportMonth}-01`;
    search.add({ apply: (query) => {
      const start = query.param(firstDay);
      query.where(`${date} >= ${start}::date and ${date} < ${start}::date + interval '1 month'`);
    } });
  }
  if (input.customerKey) search.add(new ExactMatchCriterion(sql("customer.key"), input.customerKey));
  return search;
}

/** Tìm theo mã, đơn hàng, người nhận, mã tham chiếu, tên khách và nội dung thanh toán. */
const paymentTextColumns = [
  sql("d.ma_hien_thi"),
  sql("d.ma_don_hang"),
  sql("d.ma_tham_chieu"),
  sql("d.ma_tham_chieu_chi_tiet::text"),
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
