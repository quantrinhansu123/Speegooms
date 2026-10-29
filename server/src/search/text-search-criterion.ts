import type { SearchCriterion } from "./search-criterion";
import type { SearchQuery } from "./search-query";
import type { SqlExpression } from "./sql-expression";

/** Tìm một chuỗi trên nhiều cột, không phân biệt hoa thường. */
export class TextSearchCriterion implements SearchCriterion {
  constructor(
    private readonly text: string,
    private readonly columns: readonly SqlExpression[],
  ) {}

  apply(query: SearchQuery): void {
    const text = this.text.trim();
    if (!text || this.columns.length === 0) return;
    const pattern = query.param(`%${text}%`);
    const matches = this.columns.map((column) => `${column} ilike ${pattern}`);
    query.where(`(${matches.join(" or ")})`);
  }
}
