import type { QuoteOrder } from "./crm";

/** Carry product information across desks; transport pricing is entered independently. */
export function logisticsOrderFromSourcing(order: QuoteOrder): QuoteOrder {
  return {
    ...order,
    selected: true,
    lines: order.lines.map((line) => ({ ...line, pricePerSet: null, lineTotal: null, basis: "unit" })),
  };
}
