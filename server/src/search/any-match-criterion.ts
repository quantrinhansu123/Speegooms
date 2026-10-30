import type { SearchCriterion } from "./search-criterion";
import type { SearchQuery } from "./search-query";
import type { SqlExpression } from "./sql-expression";

/** Khớp một trong các giá trị (`= any(...)`). `undefined` thì bỏ qua điều kiện; mảng rỗng thì không khớp dòng nào. */
export class AnyMatchCriterion implements SearchCriterion {
  constructor(
    private readonly column: SqlExpression,
    private readonly values: readonly string[] | undefined,
    private readonly castAs: "text" | "uuid" = "text",
  ) {}

  apply(query: SearchQuery): void {
    if (!this.values) return;
    query.where(`${this.column} = any(${query.param(this.values)}::${this.castAs}[])`);
  }
}
