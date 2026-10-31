/** Persisted on the customer: deleting a quote must never reset its workflow. */
export type QuoteWorkflow = "LEGACY" | "COMBINED";

export function isCombinedSourcing(record: { customerKind: string | null; quoteWorkflow: QuoteWorkflow }): boolean {
  return record.customerKind === "SOURCING" && record.quoteWorkflow === "COMBINED";
}

/** Internal access scope, independent of the customer kinds accepted by forms/API. */
export function quoteAccessKind(record: { customerKind: string | null; quoteWorkflow: QuoteWorkflow }): string | null {
  return isCombinedSourcing(record) ? "SOURCING_LOGISTICS" : record.customerKind;
}
