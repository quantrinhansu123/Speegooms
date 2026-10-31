import type { QuoteDesk, UpdateQuoteInput } from "@speego/shared";
import type { QuoteRecord } from "../repositories/crm.repository";

export function quoteDeskPatch(desk: QuoteDesk, current: QuoteRecord, input: UpdateQuoteInput): UpdateQuoteInput {
  if (desk === "logistics") return {
    templateId: current.templateId,
    opsNote: current.opsNote ?? "",
    quoteStatus: current.quoteStatus as UpdateQuoteInput["quoteStatus"],
    contractStatus: current.contractStatus as UpdateQuoteInput["contractStatus"],
    orders: current.orders,
    bank: current.bank,
    notes: { ...current.notes, logisticsFees: input.notes.logisticsFees, shippingLabel: input.notes.shippingLabel },
  };
  return { ...input, notes: { ...input.notes, logisticsFees: current.notes.logisticsFees, shippingLabel: current.notes.shippingLabel } };
}
