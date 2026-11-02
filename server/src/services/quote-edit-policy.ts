import type { QuoteDesk, QuoteOrder, UpdateQuoteInput } from "@speego/shared";
import type { QuoteRecord } from "../repositories/crm.repository";

/** Logistics giữ hàng hóa của Sale/Sourcing, chỉ nhận đơn giá và cột tiền vận hành nhập. */
function logisticsOrders(current: QuoteOrder[], input: QuoteOrder[]): QuoteOrder[] {
  if (input.length === 0) return current;
  return input.map((order) => {
    const previous = current.find((item) => item.id === order.id);
    if (!previous) return order;
    return {
      ...previous,
      selected: order.selected,
      currency: order.currency,
      rate: order.rate,
      priceColumns: order.priceColumns,
      lines: previous.lines.map((line, index) => {
        const next = order.lines.find((item) => item.stt === line.stt) ?? order.lines[index];
        if (!next) return line;
        return {
          ...line,
          pricePerSet: next.pricePerSet,
          lineTotal: next.lineTotal,
          prices: next.prices ?? [],
          basis: next.basis,
        };
      }),
    };
  });
}

export function quoteDeskPatch(desk: QuoteDesk, current: QuoteRecord, input: UpdateQuoteInput): UpdateQuoteInput {
  if (desk === "logistics") return {
    templateId: input.templateId ?? current.templateId,
    opsNote: input.opsNote,
    quoteStatus: current.quoteStatus as UpdateQuoteInput["quoteStatus"],
    contractStatus: current.contractStatus as UpdateQuoteInput["contractStatus"],
    orders: logisticsOrders(current.orders, input.orders),
    bank: current.bank,
    notes: {
      ...current.notes,
      logisticsFees: input.notes.logisticsFees,
      shippingLabel: input.notes.shippingLabel,
      opsExtra: input.notes.opsExtra,
    },
  };
  return {
    ...input,
    notes: { ...input.notes, logisticsFees: current.notes.logisticsFees, shippingLabel: current.notes.shippingLabel },
  };
}
