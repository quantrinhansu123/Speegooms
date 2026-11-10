import { applyLogisticsDeskSave, preserveQuotePrices, quoteDeskPatch } from "./quote-edit-policy";
import { contractQuoteMessage, contractQuoteProblems, isCombinedSourcing, orderShippingChanged, quoteAccessKind, quotePaymentSummary } from "@speego/shared";
import {
  canAccessQuoteDesk,
  canEditQuoteDesk,
  canViewCustomerKind,
  canViewQuote,
  visibleCustomerKinds,
  visibleKindsForDesk,
  type AccountingContractInput,
  type ConvertMessageInput,
  type CreateContractInput,
  type CreateMessageInput,
  type CrmLane,
  type OpsContractInput,
  type PublicUser,
  type QuoteDesk,
  type QuoteTemplateInput,
  type Role,
  type SaleContractPaymentInput,
  type UpdateMessageInput,
  type UpdatePotentialInput,
  type UpdateQuoteInput,
  type UpdateQuoteOutcomeInput,
} from "@speego/shared";
import { can } from "../config/permissions";
import { AppError } from "../lib/errors";
import {
  emptyListSearch,
  type ContractListSearch,
  type MessageListSearch,
  type PotentialListSearch,
  type QuoteListSearch,
} from "../search/crm-list-search";
import type {
  CrmRepository,
  MessageRecord,
  PotentialRecord,
  ContractRecord,
  ContractView,
  QuoteRecord,
  QuoteTemplateRecord,
  RfqQuoteRecord,
} from "../repositories/crm.repository";
import type { NotificationService } from "./notification.service";
import type { CrmImportService, ImportResult } from "./crm-import.service";
import type { ImportKind } from "./crm-import-sheets";

export interface QuoteTracking {
  potential: PotentialRecord | null;
  quotes: RfqQuoteRecord[];
  contracts: ContractRecord[];
}

type MessageActor = { id: string; role: Role; name?: string };

export class CrmService {
  constructor(
    private readonly crm: CrmRepository | null,
    private readonly notifications: NotificationService | null = null,
    private readonly imports: CrmImportService | null = null,
  ) {}

  importTemplate(kind: ImportKind): Promise<{ name: string; body: Buffer }> {
    return this.importer().template(kind);
  }

  importWorkbook(kind: ImportKind, file: Buffer, lanes: readonly CrmLane[], creatorId?: string): Promise<ImportResult> {
    return this.importer().importWorkbook(kind, file, lanes, creatorId);
  }

  /** Mess chỉ người tạo xem được; Admin xem tất cả. Không truyền actor = nội bộ, không lọc. */
  listMessages(lane: CrmLane, search: MessageListSearch, actor?: MessageActor): Promise<MessageRecord[]> {
    return this.ready().listMessages(lane, actor && actor.role !== "admin" ? { ...search, creatorId: actor.id } : search);
  }

  /** Người không phải Admin chạm mess của người khác thì coi như không thấy (404, không lộ sự tồn tại). */
  private async assertMessageAccess(lane: CrmLane, id: string, actor?: MessageActor): Promise<void> {
    if (!actor || actor.role === "admin") return;
    const creator = await this.ready().messageCreator(lane, id);
    if (creator !== "missing" && creator !== actor.id) throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
  }

  /** Chỉ vai trò được chuyển mess mới ghi nháp thông tin đơn hàng; vai trò khác bị bỏ qua, không ghi đè nháp cũ. */
  private withOrderDraft<T extends { order?: unknown }>(input: T, role: Role | undefined): T {
    if (input.order === undefined || (role && can(role, "message.convert"))) return input;
    const { order: _ignored, ...rest } = input;
    return rest as T;
  }

  createMessage(lane: CrmLane, input: CreateMessageInput, role?: Role, creatorId?: string): Promise<MessageRecord> {
    return this.ready().createMessage(lane, this.withOrderDraft(input, role), creatorId);
  }

  async updateMessage(lane: CrmLane, id: string, input: UpdateMessageInput, role?: Role, actor?: MessageActor): Promise<MessageRecord> {
    await this.assertMessageAccess(lane, id, actor);
    const row = await this.ready().updateMessage(lane, id, this.withOrderDraft(input, role));
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
    return row;
  }

  async deleteMessage(lane: CrmLane, id: string, actor?: MessageActor): Promise<void> {
    await this.assertMessageAccess(lane, id, actor);
    const result = await this.ready().deleteMessage(lane, id);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
    if (result === "linked") throw new AppError(409, "CONFLICT", "Hãy xóa khách hàng tiềm năng của mess này trước");
  }

  async convertMessage(lane: CrmLane, id: string, input: ConvertMessageInput, actor?: MessageActor): Promise<{ message: MessageRecord; potential: PotentialRecord }> {
    await this.assertMessageAccess(lane, id, actor);
    const result = await this.ready().convertMessage(lane, id, input);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
    if (result === "lost") throw new AppError(409, "CONFLICT", "Mess đã mất, không chuyển được");
    if (actor && input.handlerId) await this.notifications?.notifyCrmHandover({ id: actor.id, name: actor.name ?? "Nhân viên" }, lane, result.potential.id, result.potential.fullName ?? result.potential.leadCode, input.handlerId).catch(() => undefined);
    return result;
  }

  listPotentials(lane: CrmLane, search: PotentialListSearch, role: Role): Promise<PotentialRecord[]> {
    const allowedKinds = visibleCustomerKinds(role);
    if (allowedKinds && allowedKinds.length === 0) return Promise.resolve([]);
    return this.ready().listPotentials(lane, { ...search, allowedKinds });
  }

  listSales(lane: CrmLane) { return this.ready().listSales(lane); }
  potentialHistory(lane: CrmLane, id: string, role: Role) { return this.ready().potentialHistory(lane, id, visibleCustomerKinds(role)); }

  async updatePotential(lane: CrmLane, id: string, input: UpdatePotentialInput, actor?: PublicUser): Promise<PotentialRecord> {
    const row = await this.ready().updatePotential(lane, id, input);
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy khách hàng tiềm năng");
    if (actor && input.handlerId) await this.notifications?.notifyCrmHandover(actor, lane, row.id, row.fullName ?? row.leadCode, input.handlerId).catch(() => undefined);
    return row;
  }

  async deletePotential(lane: CrmLane, id: string): Promise<void> {
    const ok = await this.ready().deletePotential(lane, id);
    if (!ok) throw new AppError(404, "NOT_FOUND", "Không tìm thấy khách hàng tiềm năng");
  }

  listQuotes(lane: CrmLane, desk: QuoteDesk, search: QuoteListSearch, role: Role): Promise<QuoteRecord[]> {
    this.assertDeskView(role, desk);
    return this.ready().listQuotes(lane, desk, search, visibleKindsForDesk(role, desk));
  }

  listRfqQuotes(lane: CrmLane, search: QuoteListSearch, desk: "" | "sourcing" | "logistics"): Promise<RfqQuoteRecord[]> {
    return this.ready().listRfqQuotes(lane, search, desk);
  }

  private assertDeskView(role: Role, desk: QuoteDesk): void {
    if (!canAccessQuoteDesk(role, desk)) throw new AppError(403, "FORBIDDEN", "Không có quyền xem bàn báo giá này");
  }

  private assertDeskEdit(role: Role, desk: QuoteDesk): void {
    if (!canEditQuoteDesk(role, desk)) throw new AppError(403, "FORBIDDEN", "Không có quyền thao tác bàn báo giá này");
  }

  /** Kiểm tra quyền sửa bàn và quyền với nhóm khách của bản ghi. */
  private async assertQuoteEdit(lane: CrmLane, desk: QuoteDesk, id: string, role: Role): Promise<QuoteRecord> {
    this.assertDeskEdit(role, desk);
    const quote = await this.ready().findQuote(lane, desk, id);
    if (!quote) throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (!canViewQuote(role, desk, quoteAccessKind(quote))) {
      throw new AppError(403, "FORBIDDEN", "Không có quyền với báo giá này");
    }
    return quote;
  }

  async reassignRfqQuote(lane: CrmLane, id: string, potentialId: string): Promise<QuoteRecord> {
    const result = await this.ready().reassignRfqQuote(lane, id, potentialId);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá hoặc khách hàng tiềm năng trên tuyến này");
    if (result === "kind") throw new AppError(400, "RULE", "Chọn loại khách trước khi báo giá");
    if (result === "desk") throw new AppError(409, "CONFLICT", "Khách này không cùng bàn báo giá trên tuyến đang chọn");
    if (result === "taken") throw new AppError(409, "CONFLICT", "Khách này đã có báo giá");
    return result;
  }

  async deleteRfqQuote(lane: CrmLane, id: string): Promise<void> {
    const ok = await this.ready().deleteRfqQuote(lane, id);
    if (!ok) throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá trên tuyến này");
  }

  async requestQuote(
    lane: CrmLane,
    potentialId: string,
    actor?: PublicUser,
  ): Promise<{ quote: QuoteRecord; created: boolean; desk: QuoteDesk }> {
    const result = await this.ready().requestQuote(lane, potentialId);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy khách hàng tiềm năng");
    if (result === "kind") throw new AppError(400, "RULE", "Chọn loại khách trước khi báo giá");
    if (result.created && actor) {
      await this.notifications?.notifyQuoteRequested(actor, lane, result.desk, result.quote.code, result.quote.id, quoteAccessKind(result.quote));
    }
    return result;
  }

  /** Báo giá nguồn để Sale in file hợp đồng từ hợp đồng đã tạo. */
  async contractSource(lane: CrmLane, quoteId: string, role: Role): Promise<QuoteRecord> {
    const quote = await this.ready().findQuote(lane, "sourcing", quoteId);
    if (!quote) throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (!canViewQuote(role, "sourcing", quoteAccessKind(quote))) {
      throw new AppError(403, "FORBIDDEN", "Không có quyền với báo giá này");
    }
    return quote;
  }

  /** Logistics mở đơn thuần logistics đã có để nhập giá, không tạo báo giá mới. */
  async potentialLogisticsQuote(lane: CrmLane, potentialId: string, role: Role): Promise<QuoteRecord> {
    this.assertDeskView(role, "logistics");
    const quote = await this.ready().findQuoteByPotential(lane, "logistics", potentialId);
    if (!quote || quote.customerKind !== "LOGISTICS") {
      throw new AppError(404, "NOT_FOUND", "Sale chưa tạo thông tin đơn hàng");
    }
    if (!canViewQuote(role, "logistics", quoteAccessKind(quote))) {
      throw new AppError(403, "FORBIDDEN", "Không có quyền với báo giá này");
    }
    return quote;
  }

  /** Sale đã nhập đơn hàng thuần logistics và chuyển cho bàn Logistics lập báo giá. */
  async handoffLogisticsOrder(lane: CrmLane, quoteId: string, actor: PublicUser): Promise<QuoteRecord> {
    const quote = await this.ready().findQuote(lane, "logistics", quoteId);
    if (!quote) throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (quote.customerKind !== "LOGISTICS") throw new AppError(409, "CONFLICT", "Chỉ khách thuần logistics mới chuyển theo luồng này");
    if (quote.shippingMode === "SEA" && quote.logisticsClass === "FCL") {
      const fcl = quote.notes.fcl;
      if (!fcl?.commodity.trim() || !fcl.weight.trim() || !fcl.volume.trim()) {
        throw new AppError(400, "RULE", "Nhập hàng hóa, trọng lượng và số lượng/loại container trước khi chuyển logistics");
      }
    } else if (quote.orders.length === 0 || quote.orders.some((order) => order.lines.length === 0 || order.lines.some((line) => line.packages.length === 0 && !(line.weightKg != null && line.weightKg > 0)))) {
      throw new AppError(400, "RULE", "Nhập đơn hàng và quy cách đóng gói hoặc cân tính cước mỗi dòng trước khi chuyển logistics");
    }
    await this.notifications?.notifyQuoteRequested(actor, lane, "logistics", quote.code, quote.id, quote.customerKind);
    return quote;
  }

  /** Sale đã nhập mặt hàng tìm hàng và chuyển cho bàn Sourcing lập báo giá. */
  async handoffSourcingOrder(lane: CrmLane, quoteId: string, actor: PublicUser): Promise<QuoteRecord> {
    const quote = await this.ready().findQuote(lane, "sourcing", quoteId);
    if (!quote) throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (quote.customerKind !== "SOURCING") throw new AppError(409, "CONFLICT", "Chỉ khách Tìm hàng mới chuyển cho Sourcing");
    const ready = quote.orders.some((order) => order.lines.some((line) => line.productName?.trim() && line.quantity != null && line.quantity > 0));
    if (!ready) throw new AppError(400, "RULE", "Nhập mặt hàng và số lượng trước khi chuyển Sourcing");
    await this.notifications?.notifyQuoteRequested(actor, lane, "sourcing", quote.code, quote.id, quote.customerKind);
    return quote;
  }

  async requestLogisticsQuote(
    lane: CrmLane,
    sourcingQuoteId: string,
    actor: PublicUser,
  ): Promise<{ quote: QuoteRecord; created: boolean }> {
    this.assertDeskEdit(actor.role, "sourcing");
    const result = await this.ready().requestLogisticsQuote(lane, sourcingQuoteId);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá Sourcing");
    if (result === "kind") throw new AppError(409, "CONFLICT", "Chỉ khách Sourcing mới tạo báo giá Logistics");
    if (result === "empty") throw new AppError(400, "RULE", "Nhập thông tin đơn hàng ở Sourcing trước khi chuyển sang Logistics");
    await this.notifications?.notifyQuoteRequested(
      actor,
      lane,
      "logistics",
      result.quote.code,
      result.quote.id,
      quoteAccessKind(result.quote),
    );
    return result;
  }

  async updateQuote(
    lane: CrmLane,
    desk: QuoteDesk,
    id: string,
    input: UpdateQuoteInput,
    options: { contentOnly: boolean; role: Role },
  ): Promise<QuoteRecord> {
    if (!options.contentOnly) await this.assertQuoteEdit(lane, desk, id, options.role);
    const current = await this.ready().findQuote(lane, desk, id);
    if (!current) throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    const content = options.contentOnly ? preserveQuotePrices(current, input) : input;
    const deskPatch = quoteDeskPatch(desk, current, content);
    const patch = desk === "logistics"
      ? applyLogisticsDeskSave(current, input, content, deskPatch, {
        contentOnly: options.contentOnly,
        canOps: can(options.role, "quote.ops"),
        canRequest: can(options.role, "quote.request"),
      })
      : deskPatch;
    const paymentError = desk === "logistics" ? quotePaymentSummary({ ...current, ...patch })?.error : "";
    if (paymentError) throw new AppError(400, "RULE", paymentError);
    const result = await this.ready().updateQuote(lane, desk, id, patch);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (result === "template") throw new AppError(400, "RULE", "Mẫu không thuộc bàn báo giá này");
    return result;
  }

  async updateQuoteOutcome(
    lane: CrmLane,
    desk: QuoteDesk,
    id: string,
    input: UpdateQuoteOutcomeInput,
  ): Promise<QuoteRecord> {
    const result = await this.ready().updateQuoteOutcome(lane, desk, id, input);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (result === "locked") throw new AppError(409, "CONFLICT", "Không thể sửa lý do sau khi đã tạo hợp đồng");
    return result;
  }

  async sendQuote(
    lane: CrmLane,
    desk: QuoteDesk,
    id: string,
    input: UpdateQuoteInput,
    actor: PublicUser,
  ): Promise<QuoteRecord> {
    const current = await this.assertQuoteEdit(lane, desk, id, actor.role);
    const patched = quoteDeskPatch(desk, current, input);
    if (!patched.notes.validityDays) throw new AppError(400, "RULE", "Nhập số ngày hiệu lực báo giá trước khi gửi");
    let orders = patched.orders.length > 0 ? patched.orders : current.orders;
    if (orders.length === 0 && current.sourcingContext?.order) {
      orders = [{ ...current.sourcingContext.order, selected: true }];
    }
    if (orders.length > 0 && !orders.some((order) => order.selected)) {
      orders = orders.map((order, index) => ({ ...order, selected: index === 0 }));
    }
    const paymentError = desk === "logistics" ? quotePaymentSummary({ ...current, ...patched, orders })?.error : "";
    if (paymentError) throw new AppError(400, "RULE", paymentError);
    const result = await this.ready().sendQuote(lane, desk, id, { ...patched, orders });
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (result === "empty") throw new AppError(400, "RULE", "Tạo thông tin đơn hàng trước khi gửi báo giá");
    if (result === "selection") throw new AppError(400, "RULE", "Chọn một mẫu báo giá trước khi gửi");
    if (result === "template") throw new AppError(400, "RULE", "Mẫu không thuộc bàn báo giá này");
    await this.notifications?.notifyQuoteSent(actor, lane, desk, result.code, result.id);
    const reopened = await this.reopenLogisticsAfterSourcingChange(lane, desk, current, orders.find((order) => order.selected), actor);
    return reopened ?? result;
  }

  /**
   * KH Sourcing luồng gộp: Sourcing gửi lại với đơn hàng đổi phần ảnh hưởng tới cước thì báo giá Logistics đã gửi
   * không còn khớp. Đưa phiếu Logistics về "Chưa có báo giá lại" và báo Logistics làm lại, để hợp đồng chờ cước mới.
   */
  private async reopenLogisticsAfterSourcingChange(
    lane: CrmLane,
    desk: QuoteDesk,
    current: QuoteRecord,
    sentOrder: UpdateQuoteInput["orders"][number] | undefined,
    actor: PublicUser,
  ): Promise<QuoteRecord | null> {
    if (desk !== "sourcing" || !isCombinedSourcing(current) || !sentOrder) return null;
    const logistics = current.logisticsSheet;
    if (!logistics?.sentQuote || (logistics.quoteStatus !== "DA_CO_BAO_GIA" && logistics.quoteStatus !== "DA_CO_BAO_GIA_LAI")) return null;
    if (!orderShippingChanged(current.sentQuote?.order, sentOrder)) return null;
    const reopened = await this.ready().returnQuote(lane, "logistics", current.id);
    if (typeof reopened === "string") return null;
    await this.notifications?.notifyQuoteReturned(actor, lane, "logistics", reopened.code, reopened.id, quoteAccessKind(reopened));
    return this.ready().findQuote(lane, "sourcing", current.id);
  }

  async returnQuote(lane: CrmLane, desk: QuoteDesk, id: string, actor?: PublicUser): Promise<QuoteRecord> {
    const result = await this.ready().returnQuote(lane, desk, id);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (result === "state") throw new AppError(409, "CONFLICT", "Báo giá chưa được vận hành gửi");
    if (result === "contract") throw new AppError(409, "CONFLICT", "Báo giá đã tạo hợp đồng nên không gửi lại được. Xóa hoặc sửa hợp đồng trước.");
    if (actor) {
      await this.notifications?.notifyQuoteReturned(
        actor,
        lane,
        desk,
        result.code,
        result.id,
        quoteAccessKind(result),
      );
    }
    return result;
  }

  listQuoteTemplates(desk: QuoteDesk, role: Role): Promise<QuoteTemplateRecord[]> {
    this.assertDeskView(role, desk);
    return this.ready().listQuoteTemplates(desk);
  }

  async createQuoteTemplate(desk: QuoteDesk, input: QuoteTemplateInput, role: Role): Promise<QuoteTemplateRecord> {
    this.assertDeskEdit(role, desk);
    const result = await this.ready().createQuoteTemplate(desk, input);
    if (result === "duplicate") throw new AppError(409, "CONFLICT", "Đã có mẫu này");
    return result;
  }

  async updateQuoteTemplate(desk: QuoteDesk, id: string, input: QuoteTemplateInput, role: Role): Promise<QuoteTemplateRecord> {
    this.assertDeskEdit(role, desk);
    const result = await this.ready().updateQuoteTemplate(desk, id, input);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy mẫu báo giá");
    if (result === "duplicate") throw new AppError(409, "CONFLICT", "Đã có mẫu này");
    return result;
  }

  async deleteQuoteTemplate(desk: QuoteDesk, id: string, role: Role): Promise<void> {
    this.assertDeskEdit(role, desk);
    const result = await this.ready().deleteQuoteTemplate(desk, id);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy mẫu báo giá");
    if (result === "used") throw new AppError(409, "CONFLICT", "Mẫu đang được dùng trong báo giá");
  }

  listContracts(lane: CrmLane, sentOnly: boolean, view: ContractView, search: ContractListSearch): Promise<ContractRecord[]> {
    return this.ready().listContracts(lane, sentOnly, view, search);
  }

  /** Hồ sơ một khách: tiềm năng, báo giá và hợp đồng liên kết — Sale xem đủ; bàn ops lọc theo ACL. */
  async getQuoteTracking(lane: CrmLane, potentialId: string, role: Role): Promise<QuoteTracking> {
    const potentialIds = [potentialId];
    const quoteSearch = { ...emptyListSearch, quoteStatus: "", contractStatus: "", customerKind: "", potentialIds };
    const [potentials, quotes] = await Promise.all([
      this.ready().listPotentials(lane, { ...emptyListSearch, source: "", potential: "", customerKind: "", customerType: "", potentialIds }),
      this.listTrackingQuotes(lane, quoteSearch, role),
    ]);
    const potential = potentials[0] ?? null;
    // Menu KH tiềm năng / theo dõi: thuần LOGISTICS thì sourcing không xem được.
    if (potential && !canViewCustomerKind(role, potential.customerKind) && !can(role, "quote.rfq")) {
      throw new AppError(403, "FORBIDDEN", "Không có quyền xem hồ sơ khách hàng này");
    }
    const quoteIds = [...new Set(quotes.flatMap((quote) => [quote.id, quote.logisticsQuoteId].filter((id): id is string => Boolean(id))))];
    const contracts = quoteIds.length
      ? await this.ready().listContracts(lane, false, "sale", { ...emptyListSearch, opsStatus: "", accountingStatus: "", quoteIds })
      : [];
    return { potential, quotes, contracts };
  }

  /** Sale/RFQ: đủ hai bàn. Sourcing/Logistics/VH: chỉ phần được phép theo desk policy. */
  private async listTrackingQuotes(
    lane: CrmLane,
    search: QuoteListSearch,
    role: Role,
  ): Promise<RfqQuoteRecord[]> {
    if (can(role, "quote.rfq")) {
      return this.ready().listRfqQuotes(lane, search, "");
    }
    const [sourcing, logistics] = await Promise.all([
      canAccessQuoteDesk(role, "sourcing")
        ? this.ready().listQuotes(lane, "sourcing", search, visibleKindsForDesk(role, "sourcing"))
        : Promise.resolve([]),
      canAccessQuoteDesk(role, "logistics")
        ? this.ready().listQuotes(lane, "logistics", search, visibleKindsForDesk(role, "logistics"))
        : Promise.resolve([]),
    ]);
    const sourcingRows = sourcing.map((quote) => ({ ...quote, desk: "sourcing" as const }));
    const covered = new Set(sourcingRows.map((quote) => quote.id));
    const logisticsRows = logistics
      .filter((quote) => !isCombinedSourcing(quote) || !covered.has(quote.id))
      .map((quote) => ({ ...quote, desk: "logistics" as const }));
    return [...sourcingRows, ...logisticsRows].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createContract(
    lane: CrmLane,
    quoteId: string,
    input: CreateContractInput,
    actor?: PublicUser,
  ): Promise<ContractRecord> {
    const source = await this.ready().findQuote(lane, "sourcing", quoteId) ?? await this.ready().findQuote(lane, "logistics", quoteId);
    if (!source) throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    const problems = contractQuoteProblems(source);
    if (problems.length > 0) throw new AppError(409, "CONFLICT", contractQuoteMessage(problems));
    const result = await this.ready().createContract(lane, quoteId, input);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (actor) await this.notifications?.notifyContractCreated(actor, lane, result.code, result.id);
    return result;
  }

  async updateOpsContract(lane: CrmLane, id: string, input: OpsContractInput): Promise<ContractRecord> {
    const result = await this.ready().updateOpsContract(lane, id, input);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy hợp đồng");
    return result;
  }

  async updateAccountingContract(lane: CrmLane, id: string, input: AccountingContractInput): Promise<ContractRecord> {
    const result = await this.ready().updateAccountingContract(lane, id, input);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy hợp đồng");
    if (result === "pending") throw new AppError(409, "CONFLICT", "Vận hành chưa gửi hợp đồng sang kế toán");
    return result;
  }

  async updateCommercialContract(lane: CrmLane, id: string, input: SaleContractPaymentInput): Promise<ContractRecord> {
    const result = await this.ready().updateCommercialContract(lane, id, input);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy hợp đồng");
    if (result === "invalid") throw new AppError(400, "VALIDATION", "Tổng đã thanh toán (quy đổi VND) không được lớn hơn tổng giá trị hợp đồng");
    return result;
  }

  async resendContract(
    lane: CrmLane,
    id: string,
    target: "ops" | "accounting" | "parties",
    actor?: PublicUser,
  ): Promise<ContractRecord> {
    const result = await this.ready().resendContract(lane, id, target);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy hợp đồng");
    if (result === "pending") throw new AppError(409, "CONFLICT", "Vận hành chưa gửi hợp đồng sang kế toán");
    if (actor) await this.notifications?.notifyContractResent(actor, lane, target, result.code, result.id);
    return result;
  }

  async deleteContract(lane: CrmLane, id: string): Promise<void> {
    const result = await this.ready().deleteContract(lane, id);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy hợp đồng");
  }

  private ready(): CrmRepository {
    if (!this.crm) throw new AppError(503, "UNAVAILABLE", "CRM cần kết nối Postgres");
    return this.crm;
  }

  private importer(): CrmImportService {
    if (!this.imports) throw new AppError(503, "UNAVAILABLE", "Import cần kết nối Postgres");
    return this.imports;
  }
}
