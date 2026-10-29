import type { SearchCriterion } from "./search-criterion";
import { ParameterSearchQuery, type CompiledSearch } from "./search-query";

/** Ghép các điều kiện thành mệnh đề WHERE đã tham số hóa. */
export class SearchBuilder {
  private readonly criteria: SearchCriterion[] = [];

  add(criterion: SearchCriterion): this {
    this.criteria.push(criterion);
    return this;
  }

  build(startAt = 1): CompiledSearch {
    const query = new ParameterSearchQuery(startAt);
    for (const criterion of this.criteria) criterion.apply(query);
    return query.compile();
  }
}
