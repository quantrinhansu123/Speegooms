import type { SearchQuery } from "./search-query";

/** Một điều kiện tìm kiếm. Lớp mới thêm được mà không sửa builder. */
export interface SearchCriterion {
  apply(query: SearchQuery): void;
}
