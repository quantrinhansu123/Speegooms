import { randomUUID } from "node:crypto";
import { createContractSchema, defaultQuoteBank, quoteOrderSchema, type CrmLane, type QuoteOrder, type UpdateQuoteInput } from "@speego/shared";
import { ZodError } from "zod";
import type { PostgresCrmImportStore } from "../adapters/postgres/crm-import.store";
import { AppError } from "../lib/errors";
import type { CrmRepository } from "../repositories/crm.repository";
import {
  buildTemplate,
  planContracts,
  planMessages,
  planPotentials,
  planQuotes,
  readWorkbook,
  type ImportIssue,
  type ImportKind,
  type PlannedContract,
  type PlannedQuote,
} from "./crm-import-sheets";

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportIssue[];
  errorCount: number;
};

const ERROR_LIMIT = 20;

export class CrmImportService {
  constructor(
    private readonly crm: CrmRepository,
    private readonly store: PostgresCrmImportStore,
  ) {}

  template(kind: ImportKind): Promise<{ name: string; body: Buffer }> {
    return buildTemplate(kind);
  }

  async importWorkbook(kind: ImportKind, buffer: Buffer, scope: readonly CrmLane[], creatorId?: string): Promise<ImportResult> {
    if (scope.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Chọn tuyến Việt Nam hoặc Global");
    const book = await this.workbook(buffer);
    if (kind === "messages") return this.writeMessages(book, scope, creatorId);
    if (kind === "potentials") return this.writePotentials(book, scope);
    if (kind === "quotes") return this.writeQuotes(book, scope);
    return this.writeContracts(book, scope);
  }

  private async writeMessages(book: Awaited<ReturnType<typeof readWorkbook>>, scope: readonly CrmLane[], creatorId?: string): Promise<ImportResult> {
    const plan = this.planned(() => planMessages(book, scope));
    const result = tally(plan);
    for (const row of plan.rows) {
      try {
        const saved = await this.store.saveMessage(row, creatorId);
        result[saved] += 1;
      } catch (error) {
        addError(result, { sheet: row.sheet, row: row.row, message: explain(error) });
      }
    }
    return result;
  }

  private async writePotentials(book: Awaited<ReturnType<typeof readWorkbook>>, scope: readonly CrmLane[]): Promise<ImportResult> {
    const plan = this.planned(() => planPotentials(book, scope));
    const result = tally(plan);
    for (const row of plan.rows) {
      try {
        const saved = await this.store.savePotential(row);
        if (saved === "created" || saved === "updated") result[saved] += 1;
        else if (saved === "no-mess") addError(result, { sheet: row.sheet, row: row.row, message: `Chưa có mess ${row.messRef}. Hãy import Mess trước.` });
        else if (saved === "taken") addError(result, { sheet: row.sheet, row: row.row, message: "Mess này đã gắn với một khách tiềm năng khác" });
        else addError(result, { sheet: row.sheet, row: row.row, message: "Cần số điện thoại hoặc email" });
      } catch (error) {
        addError(result, { sheet: row.sheet, row: row.row, message: explain(error) });
      }
    }
    return result;
  }

  private async writeQuotes(book: Awaited<ReturnType<typeof readWorkbook>>, scope: readonly CrmLane[]): Promise<ImportResult> {
    const plan = this.planned(() => planQuotes(book, scope));
    const result = tally(plan);
    for (const row of plan.rows) {
      try {
        const saved = await this.writeQuote(row);
        if (saved === "skipped") result.skipped += 1;
        else result[saved] += 1;
      } catch (error) {
        addError(result, { sheet: row.sheet, row: row.row, message: explain(error) });
      }
    }
    return result;
  }

  private async writeQuote(row: PlannedQuote): Promise<"created" | "updated" | "skipped"> {
    const found = await this.store.findPotential(row.lane, row.externalRef);
    if (!found) throw new AppError(400, "RULE", "Chưa có khách tiềm năng cho RFQ này. Hãy import Khách tiềm năng trước.");
    const combined = row.kind === "BOTH" || (row.productPrice != null && row.freight != null);
    const kind = row.kind === "LOGISTICS" ? "LOGISTICS" : "SOURCING";
    const ensured = await this.store.ensureKind(row.lane, found.id, found.kind === "SOURCING" || found.kind === "LOGISTICS" ? null : kind, combined);
    if (!ensured?.kind) throw new AppError(400, "RULE", "Chưa có loại khách SOURCING hoặc LOGISTICS");
    const requested = await this.crm.requestQuote(row.lane, found.id);
    if (requested === "missing") throw new AppError(400, "RULE", "Không tìm thấy khách tiềm năng");
    if (requested === "kind") throw new AppError(400, "RULE", "Chưa có loại khách SOURCING hoặc LOGISTICS");
    let wrote = false;
    const currency = row.currency || "USD";
    if (!requested.quote.sentQuote) {
      const price = requested.desk === "logistics" ? (row.freight ?? row.productPrice) : row.productPrice;
      const order = quoteOrder(row.goods, currency, price, row, "unit");
      await this.saveQuoteOrders(row.lane, requested.desk, requested.quote.id, [order], price != null);
      wrote = true;
    }
    if (requested.desk === "sourcing" && ensured.workflow === "COMBINED" && row.freight != null && !requested.quote.logisticsSheet?.sentQuote) {
      const freightOrder = quoteOrder("Cước vận chuyển", currency, row.freight, row, "lump");
      const status = row.freight != null ? "DA_CO_BAO_GIA" : "CHUA_CO_BAO_GIA";
      wrote = await this.store.replaceLogisticsOrders(row.lane, requested.quote.id, emptySheet(), [freightOrder], status) || wrote;
    }
    if (!wrote) return "skipped";
    return requested.created ? "created" : "updated";
  }

  private async saveQuoteOrders(lane: CrmLane, desk: "sourcing" | "logistics", id: string, orders: QuoteOrder[], hasPrice: boolean): Promise<void> {
    const current = await this.crm.findQuote(lane, desk, id);
    if (!current) throw new AppError(400, "RULE", "Không tìm thấy báo giá");
    const input: UpdateQuoteInput = {
      templateId: current.templateId,
      opsNote: current.opsNote ?? "",
      quoteStatus: nextStatus(current.quoteStatus, hasPrice),
      contractStatus: current.contractStatus === "DA_TAO" ? "DA_TAO" : "CHUA_TAO",
      orders,
      notes: current.notes,
      bank: current.bank,
    };
    const saved = await this.crm.updateQuote(lane, desk, id, input);
    if (saved === "missing") throw new AppError(400, "RULE", "Không tìm thấy báo giá");
    if (saved === "template") throw new AppError(400, "RULE", "Mẫu báo giá không hợp lệ");
  }

  private async writeContracts(book: Awaited<ReturnType<typeof readWorkbook>>, scope: readonly CrmLane[]): Promise<ImportResult> {
    const plan = this.planned(() => planContracts(book, scope));
    const result = tally(plan);
    for (const row of plan.rows) {
      try {
        const saved = await this.writeContract(row);
        result[saved] += 1;
      } catch (error) {
        addError(result, { sheet: row.sheet, row: row.row, message: explain(error) });
      }
    }
    return result;
  }

  private async writeContract(row: PlannedContract): Promise<"created" | "updated"> {
    const link = await this.store.findQuoteLink(row.lane, row.rfqRef);
    if (!link) throw new AppError(400, "RULE", "Chưa có báo giá cho RFQ này. Hãy import Báo giá trước.");
    const input = createContractSchema.parse({
      currency: row.currency,
      customerName: row.customerName,
      saleName: row.saleName,
      shipTo: "",
      product: row.product,
      quantity: row.quantity,
      productValue: row.productValue,
      shippingCost: row.shippingCost,
      totalValue: row.totalValue,
      paidAmount: row.paidAmount,
      signedOn: row.signedOn,
    });
    const state = await this.store.contractState(row.lane, link.quoteId);
    if (!state) {
      const created = await this.crm.createContract(row.lane, link.quoteId, { ...input, paidAmount: 0 });
      if (created === "missing") throw new AppError(400, "RULE", "Không tạo được hợp đồng từ báo giá");
      await this.store.updateContract(created.id, row.lane, { ...row, paidAmount: input.paidAmount, replacePaid: true });
      return "created";
    }
    if (state.locked && input.totalValue < state.paid) {
      throw new AppError(400, "RULE", "Hợp đồng đã có bill, tổng mới nhỏ hơn số tiền đã thanh toán");
    }
    await this.store.updateContract(state.id, row.lane, { ...row, paidAmount: state.locked ? state.paid : input.paidAmount, replacePaid: !state.locked });
    return "updated";
  }

  private async workbook(buffer: Buffer): Promise<Awaited<ReturnType<typeof readWorkbook>>> {
    try {
      return await readWorkbook(buffer);
    } catch (error) {
      throw workbookError(error);
    }
  }

  private planned<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      throw workbookError(error);
    }
  }
}

function quoteOrder(name: string, currency: string, price: number | null, row: PlannedQuote, basis: "unit" | "lump"): QuoteOrder {
  const quantity = basis === "lump" ? 1 : row.quantity;
  const lineTotal = price == null ? null : basis === "lump" ? price : quantity == null ? null : Math.round(quantity * price * 100) / 100;
  return quoteOrderSchema.parse({
    id: randomUUID(),
    name: name.slice(0, 160) || "Đơn hàng",
    selected: true,
    currency,
    rate: null,
    priceColumns: [],
    lines: [{
      stt: "1",
      image: "",
      images: [],
      quantity,
      pricePerSet: price,
      lineTotal,
      weightKg: row.weightKg,
      spec: row.spec,
      note: row.requirements,
      unit: basis === "lump" ? "lô" : "cái",
      basis,
      cbm: null,
      packages: [],
      attrs: [],
      prices: [],
    }],
  });
}

function emptySheet() {
  return {
    templateId: null,
    opsNote: "",
    quoteStatus: "CHUA_CO_BAO_GIA",
    contractStatus: "CHUA_TAO",
    orders: [],
    notes: { totalLabel: "", shippingLabel: "", weightNote: "", validityNote: "", deposit: [], logisticsFees: [], opsExtra: "", freight: { rate: null, total: null, totalManual: false } },
    bank: defaultQuoteBank,
    sentQuote: null,
  };
}

function nextStatus(current: string, hasPrice: boolean): UpdateQuoteInput["quoteStatus"] {
  if (current === "DA_CO_BAO_GIA_LAI" || current === "CHUA_CO_BAO_GIA_LAI") {
    return hasPrice ? "DA_CO_BAO_GIA_LAI" : current;
  }
  if (current === "DA_CO_BAO_GIA") return "DA_CO_BAO_GIA";
  return hasPrice ? "DA_CO_BAO_GIA" : "CHUA_CO_BAO_GIA";
}

function tally(plan: { errors: ImportIssue[]; skipped: number }): ImportResult {
  if (plan.errors.length === 0 && plan.skipped === 0 && "rows" in plan && Array.isArray((plan as { rows: unknown[] }).rows) && (plan as { rows: unknown[] }).rows.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Không có dòng dữ liệu. Dòng ví dụ bắt đầu bằng VD- không được nhập.");
  }
  return {
    created: 0,
    updated: 0,
    skipped: plan.skipped,
    errors: plan.errors.slice(0, ERROR_LIMIT),
    errorCount: plan.errors.length,
  };
}

function addError(result: ImportResult, issue: ImportIssue) {
  result.errorCount += 1;
  if (result.errors.length < ERROR_LIMIT) result.errors.push(issue);
}

function explain(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof ZodError) return error.issues.map((issue) => issue.message).join(", ");
  return "Không ghi được dòng này";
}

function workbookError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Không thấy") || message.includes("vượt")) return new AppError(400, "VALIDATION_ERROR", message);
  return new AppError(400, "VALIDATION_ERROR", "File Excel không đọc được");
}
