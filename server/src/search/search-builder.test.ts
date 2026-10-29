import assert from "node:assert/strict";
import test from "node:test";
import { DateRangeCriterion } from "./date-range-criterion";
import { ExactMatchCriterion } from "./exact-match-criterion";
import { SearchBuilder } from "./search-builder";
import { sql } from "./sql-expression";
import { TextSearchCriterion } from "./text-search-criterion";

test("builder bỏ qua điều kiện rỗng", () => {
  const compiled = new SearchBuilder()
    .add(new TextSearchCriterion("  ", [sql("m.ten")]))
    .add(new DateRangeCriterion(sql("m.nhan_luc"), "", "", "timestamp"))
    .add(new ExactMatchCriterion(sql("m.trang_thai"), ""))
    .build();
  assert.equal(compiled.sql, "");
  assert.deepEqual(compiled.values, []);
});

test("builder ghép chữ, khoảng ngày và giá trị đúng", () => {
  const compiled = new SearchBuilder()
    .add(new TextSearchCriterion("hoa", [sql("m.ten"), sql("m.hang_hoa")]))
    .add(new DateRangeCriterion(sql("m.nhan_luc"), "2026-10-01", "2026-10-29", "timestamp"))
    .add(new ExactMatchCriterion(sql("m.phan_loai::text"), "HOT"))
    .build(3);
  assert.match(compiled.sql, /m\.ten ilike \$3/);
  assert.match(compiled.sql, /m\.hang_hoa ilike \$3/);
  assert.match(compiled.sql, /m\.nhan_luc >= \(\$4::date::timestamp at time zone 'Asia\/Ho_Chi_Minh'\)/);
  assert.match(compiled.sql, /m\.nhan_luc < \(\(\$5::date \+ 1\)::timestamp at time zone 'Asia\/Ho_Chi_Minh'\)/);
  assert.match(compiled.sql, /m\.phan_loai::text = \$6/);
  assert.deepEqual(compiled.values, ["%hoa%", "2026-10-01", "2026-10-29", "HOT"]);
});

test("khoảng ngày trên cột date gồm ngày kết thúc", () => {
  const compiled = new SearchBuilder()
    .add(new DateRangeCriterion(sql("h.ngay_ky"), "2026-10-01", "2026-10-02", "date"))
    .build();
  assert.equal(compiled.sql, " and h.ngay_ky >= $1::date and h.ngay_ky <= $2::date");
});
