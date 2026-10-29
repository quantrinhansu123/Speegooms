import type { SearchCriterion } from "./search-criterion";
import type { SearchQuery } from "./search-query";
import type { SqlExpression } from "./sql-expression";

/**
 * Khoảng ngày theo lịch Việt Nam.
 * `timestamp` gồm cả ngày kết thúc. `date` so sánh trực tiếp cột date.
 */
export class DateRangeCriterion implements SearchCriterion {
  constructor(
    private readonly column: SqlExpression,
    private readonly from: string,
    private readonly to: string,
    private readonly kind: "timestamp" | "date",
  ) {}

  apply(query: SearchQuery): void {
    if (this.from) query.where(this.lower(query.param(this.from)));
    if (this.to) query.where(this.upper(query.param(this.to)));
  }

  private lower(placeholder: string): string {
    if (this.kind === "date") return `${this.column} >= ${placeholder}::date`;
    return `${this.column} >= (${placeholder}::date::timestamp at time zone 'Asia/Ho_Chi_Minh')`;
  }

  private upper(placeholder: string): string {
    if (this.kind === "date") return `${this.column} <= ${placeholder}::date`;
    return `${this.column} < ((${placeholder}::date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')`;
  }
}
