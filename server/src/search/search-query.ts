export interface SearchQuery {
  param(value: unknown): string;
  where(sql: string): void;
}

export interface CompiledSearch {
  sql: string;
  values: unknown[];
}

export class ParameterSearchQuery implements SearchQuery {
  private readonly clauses: string[] = [];
  private readonly values: unknown[] = [];

  constructor(private nextIndex: number) {}

  param(value: unknown): string {
    this.values.push(value);
    const placeholder = `$${this.nextIndex}`;
    this.nextIndex += 1;
    return placeholder;
  }

  where(sql: string): void {
    const clause = sql.trim();
    if (clause) this.clauses.push(clause);
  }

  compile(): CompiledSearch {
    return {
      sql: this.clauses.length === 0 ? "" : ` and ${this.clauses.join(" and ")}`,
      values: this.values,
    };
  }
}
