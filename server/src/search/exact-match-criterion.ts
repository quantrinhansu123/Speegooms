import type { SearchCriterion } from "./search-criterion";
import type { SearchQuery } from "./search-query";
import type { SqlExpression } from "./sql-expression";

/** Khớp đúng một giá trị. Giá trị rỗng thì bỏ qua điều kiện. */
export class ExactMatchCriterion implements SearchCriterion {
  constructor(
    private readonly column: SqlExpression,
    private readonly value: string,
  ) {}

  apply(query: SearchQuery): void {
    const value = this.value.trim();
    if (!value) return;
    query.where(`${this.column} = ${query.param(value)}`);
  }
}
