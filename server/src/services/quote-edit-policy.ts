import { isCombinedSourcing, withInsuranceCurrency, type QuoteDesk, type QuoteOrder, type UpdateQuoteInput } from "@speego/shared";
import type { QuoteRecord } from "../repositories/crm.repository";

/**
 * Logistics giữ hàng hóa của Sale/Sourcing, chỉ nhận đơn giá, cách tính giá và cột tiền vận hành nhập.
 * Khách thuần logistics: Logistics định giá nên được chỉnh cả số kg/m2/CBM dùng để nhân với đơn giá.
 */
function logisticsOrders(current: QuoteOrder[], input: QuoteOrder[], pricesOwner = false): QuoteOrder[] {
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
          lineTotalManual: next.lineTotalManual === true,
          prices: next.prices ?? [],
          basis: next.basis,
          ...(pricesOwner ? { weightKg: next.weightKg, areaM2: next.areaM2, cbm: next.cbm } : {}),
        };
      }),
    };
  });
}

/** Sale chọn bảo hiểm và sửa nội dung hàng; vận hành giữ đơn giá, loại tiền và tỷ giá. */
export function preserveQuotePrices(current: QuoteRecord, input: UpdateQuoteInput): UpdateQuoteInput {
  const orders = input.orders.map((order) => {
    const previous = current.orders.find((item) => item.id === order.id);
    return {
      ...order,
      selected: previous?.selected ?? order.selected,
      currency: previous?.currency ?? (current.customerKind === "LOGISTICS" ? "VND" : order.currency),
      rate: previous ? previous.rate : null,
      priceColumns: previous ? previous.priceColumns : [],
      lines: order.lines.map((line, index) => {
        const previousLine = previous?.lines.find((item) => item.stt === line.stt) ?? previous?.lines[index];
        const packaging = isCombinedSourcing(current)
          ? { packages: previousLine?.packages ?? [], cbm: previousLine?.cbm ?? null }
          : {};
        /** Dòng mới do Sale thêm: không nhận đơn giá, thành tiền hay cách tính giá, Logistics sẽ định. */
        if (!previousLine) return { ...line, ...packaging, pricePerSet: null, lineTotal: null, lineTotalManual: false, prices: [], basis: "unit" as const };
        return {
          ...line,
          ...packaging,
          pricePerSet: previousLine.pricePerSet,
          basis: previousLine.basis,
          lineTotal: previousLine.lineTotal,
          lineTotalManual: previousLine.lineTotalManual === true,
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
    notes: { ...current.notes, weightNote: input.notes.weightNote, weightNoteEn: input.notes.weightNoteEn,
      totalLabel: input.notes.totalLabel, deposit: input.notes.deposit, depositEn: input.notes.depositEn },
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
        fcl: input.notes.fcl ? { ...input.notes.fcl, charges: current.notes.fcl?.charges ?? [] } : current.notes.fcl,
        totalLabel: input.notes.totalLabel,
        validityNote: input.notes.validityNote,
        validityNoteEn: input.notes.validityNoteEn,
        deposit: input.notes.deposit,
        depositEn: input.notes.depositEn,
        weightNote: input.notes.weightNote,
        weightNoteEn: input.notes.weightNoteEn,
      },
    };
  }
  if (options.canOps && (options.contentOnly || options.canRequest)) {
    patch = {
      ...patch,
      bank: input.bank,
      orders: options.contentOnly ? content.orders : input.orders,
      notes: {
        ...patch.notes,
        logisticsFees: input.notes.logisticsFees,
        shippingLabel: input.notes.shippingLabel,
        opsExtra: input.notes.opsExtra,
        freight: input.notes.freight,
        fcl: input.notes.fcl,
        shippingNotes: input.notes.shippingNotes,
        shippingNoteOther: input.notes.shippingNoteOther,
        payment: input.notes.payment,
      },
    };
  }
  return options.canOps ? { ...patch, orders: withInsuranceCurrency(patch.orders, { ...current, notes: patch.notes }) } : patch;
}

export function quoteDeskPatch(desk: QuoteDesk, current: QuoteRecord, input: UpdateQuoteInput): UpdateQuoteInput {
  if (desk === "logistics") return {
    templateId: input.templateId ?? current.templateId,
    opsNote: input.opsNote,
    quoteStatus: current.quoteStatus as UpdateQuoteInput["quoteStatus"],
    contractStatus: current.contractStatus as UpdateQuoteInput["contractStatus"],
    orders: withInsuranceCurrency(logisticsOrders(current.orders, input.orders, current.customerKind === "LOGISTICS"), { ...current, notes: input.notes }),
    bank: input.bank,
    notes: {
      ...current.notes,
      /** Logistics tự định số ngày hiệu lực cho báo giá của mình. */
      validityDays: input.notes.validityDays,
      payment: input.notes.payment,
      logisticsFees: input.notes.logisticsFees,
      shippingLabel: input.notes.shippingLabel,
      opsExtra: input.notes.opsExtra,
      freight: input.notes.freight,
      fcl: input.notes.fcl,
      /** Lưu ý in dưới Chi phí vận chuyển do Logistics chọn. */
      shippingNotes: input.notes.shippingNotes,
      shippingNoteOther: input.notes.shippingNoteOther,
    },
  };
  return {
    ...input,
    notes: { ...input.notes, logisticsFees: current.notes.logisticsFees, shippingLabel: current.notes.shippingLabel, freight: current.notes.freight ?? input.notes.freight, shippingNotes: current.notes.shippingNotes, shippingNoteOther: current.notes.shippingNoteOther },
  };
}
