import { isCombinedSourcing, type QuoteDesk, type QuoteOrder, type UpdateQuoteInput } from "@speego/shared";
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

/** Sale sửa nội dung đơn. Khách thuần logistics được lưu đơn giá và tỷ giá; khách khác giữ giá vận hành đã nhập. */
export function preserveQuotePrices(current: QuoteRecord, input: UpdateQuoteInput): UpdateQuoteInput {
  const saleOwnsPrices = current.customerKind === "LOGISTICS";
  const orders = input.orders.map((order) => {
    const previous = current.orders.find((item) => item.id === order.id);
    return {
      ...order,
      selected: saleOwnsPrices ? order.selected : previous?.selected ?? order.selected,
      currency: saleOwnsPrices ? order.currency : previous?.currency ?? order.currency,
      rate: saleOwnsPrices ? order.rate : previous?.rate ?? order.rate,
      priceColumns: saleOwnsPrices ? order.priceColumns : previous?.priceColumns ?? order.priceColumns,
      lines: order.lines.map((line, index) => {
        const previousLine = previous?.lines.find((item) => item.stt === line.stt) ?? previous?.lines[index];
        const packaging = isCombinedSourcing(current)
          ? { packages: previousLine?.packages ?? [], cbm: previousLine?.cbm ?? null }
          : {};
        if (!previousLine || saleOwnsPrices) return { ...line, ...packaging };
        return {
          ...line,
          ...packaging,
          pricePerSet: previousLine.pricePerSet,
          basis: previousLine.basis,
          lineTotal: previousLine.lineTotal,
          prices: previousLine.prices,
        };
      }),
    };
  });
  return {
    templateId: current.templateId,
    opsNote: current.opsNote ?? "",
    quoteStatus: current.quoteStatus as UpdateQuoteInput["quoteStatus"],
    contractStatus: current.contractStatus as UpdateQuoteInput["contractStatus"],
    orders,
    notes: current.notes,
    bank: current.bank,
  };
}

/**
 * Bàn logistics: Sale giữ đơn và ghi chú hàng hóa; Logistics giữ chi phí.
 * Báo giá thuần logistics gộp cả hai khi người lưu có đủ quyền.
 */
export function applyLogisticsDeskSave(
  current: QuoteRecord,
  input: UpdateQuoteInput,
  content: UpdateQuoteInput,
  deskPatch: UpdateQuoteInput,
  options: { contentOnly: boolean; canOps: boolean; canRequest: boolean },
): UpdateQuoteInput {
  let patch = options.contentOnly ? { ...deskPatch, orders: content.orders } : deskPatch;
  if (current.customerKind !== "LOGISTICS") return patch;
  if (options.contentOnly) {
    patch = {
      ...patch,
      notes: {
        ...patch.notes,
        totalLabel: input.notes.totalLabel,
        validityNote: input.notes.validityNote,
        deposit: input.notes.deposit,
        weightNote: input.notes.weightNote,
      },
    };
  }
  if (options.canOps && (options.contentOnly || options.canRequest)) {
    patch = {
      ...patch,
      orders: (options.contentOnly ? content : preserveQuotePrices(current, input)).orders,
      notes: {
        ...patch.notes,
        logisticsFees: input.notes.logisticsFees,
        shippingLabel: input.notes.shippingLabel,
        opsExtra: input.notes.opsExtra,
      },
    };
  }
  return patch;
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
