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

export interface QuoteTracking {
  potential: PotentialRecord | null;
  quotes: RfqQuoteRecord[];
  contracts: ContractRecord[];
}

export class CrmService {
  constructor(
    private readonly crm: CrmRepository | null,
    private readonly notifications: NotificationService | null = null,
  ) {}

  listMessages(lane: CrmLane, search: MessageListSearch): Promise<MessageRecord[]> {
    return this.ready().listMessages(lane, search);
  }

  createMessage(lane: CrmLane, input: CreateMessageInput): Promise<MessageRecord> {
    return this.ready().createMessage(lane, input);
  }

  async updateMessage(lane: CrmLane, id: string, input: UpdateMessageInput): Promise<MessageRecord> {
    const row = await this.ready().updateMessage(lane, id, input);
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
    return row;
  }

  async deleteMessage(lane: CrmLane, id: string): Promise<void> {
    const result = await this.ready().deleteMessage(lane, id);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
    if (result === "linked") throw new AppError(409, "CONFLICT", "Hãy xóa khách hàng tiềm năng của mess này trước");
  }

  async convertMessage(lane: CrmLane, id: string, input: ConvertMessageInput): Promise<{ message: MessageRecord; potential: PotentialRecord }> {
    const result = await this.ready().convertMessage(lane, id, input);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
    if (result === "lost") throw new AppError(409, "CONFLICT", "Mess đã mất, không chuyển được");
    return result;
  }

  listPotentials(lane: CrmLane, search: PotentialListSearch, role: Role): Promise<PotentialRecord[]> {
    const allowedKinds = visibleCustomerKinds(role);
    if (allowedKinds && allowedKinds.length === 0) return Promise.resolve([]);
    return this.ready().listPotentials(lane, { ...search, allowedKinds });
  }

  async updatePotential(lane: CrmLane, id: string, input: UpdatePotentialInput): Promise<PotentialRecord> {
    const row = await this.ready().updatePotential(lane, id, input);
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy khách hàng tiềm năng");
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
    if (!canViewQuote(role, desk, quote.customerKind)) {
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
    if (actor && result.created) {
      await this.notifications?.notifyQuoteRequested(
        actor,
        lane,
        result.desk,
        result.quote.code,
        result.quote.id,
        result.quote.customerKind,
      );
    }
    return result;
  }

  async requestLogisticsQuote(
    lane: CrmLane,
    sourcingQuoteId: string,
    actor: PublicUser,
  ): Promise<{ quote: QuoteRecord; created: boolean }> {
    this.assertDeskEdit(actor.role, "sourcing");
    const result = await this.ready().requestLogisticsQuote(lane, sourcingQuoteId);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá Sourcing");
    if (result === "kind") throw new AppError(409, "CONFLICT", "Chỉ khách Sourcing + Logistics mới tạo báo giá Logistics");
    if (result.created) {
      await this.notifications?.notifyQuoteRequested(
        actor,
        lane,
        "logistics",
        result.quote.code,
        result.quote.id,
        result.quote.customerKind,
      );
    }
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
    const patch = options.contentOnly ? await this.contentOnlyPatch(lane, desk, id, input) : input;
    const result = await this.ready().updateQuote(lane, desk, id, patch);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (result === "template") throw new AppError(400, "RULE", "Mẫu không thuộc bàn báo giá này");
    return result;
  }

  /** Sale chỉ được cập nhật thông tin đơn hàng; giữ nguyên giá / mẫu / trạng thái / ngân hàng do VH quản lý. */
  private async contentOnlyPatch(
    lane: CrmLane,
    desk: QuoteDesk,
    id: string,
    input: UpdateQuoteInput,
  ): Promise<UpdateQuoteInput> {
    const current = await this.ready().findQuote(lane, desk, id);
    if (!current) throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    const orders = input.orders.map((order) => {
      const previous = current.orders.find((item) => item.id === order.id);
      return {
        ...order,
        selected: previous?.selected ?? order.selected,
        lines: order.lines.map((line, index) => {
          const previousLine = previous?.lines.find((item) => item.stt === line.stt) ?? previous?.lines[index];
          if (!previousLine) return line;
          return {
            ...line,
            pricePerSet: previousLine.pricePerSet,
            basis: previousLine.basis,
            lineTotal: previousLine.lineTotal,
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

  async sendQuote(
    lane: CrmLane,
    desk: QuoteDesk,
    id: string,
    input: UpdateQuoteInput,
    actor: PublicUser,
  ): Promise<QuoteRecord> {
    await this.assertQuoteEdit(lane, desk, id, actor.role);
    const result = await this.ready().sendQuote(lane, desk, id, input);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (result === "empty") throw new AppError(400, "RULE", "Tạo thông tin đơn hàng trước khi gửi báo giá");
    if (result === "selection") throw new AppError(400, "RULE", "Chọn một mẫu báo giá trước khi gửi");
    if (result === "template") throw new AppError(400, "RULE", "Mẫu không thuộc bàn báo giá này");
    await this.notifications?.notifyQuoteSent(actor, lane, desk, result.code, result.id);
    return result;
  }

  async returnQuote(lane: CrmLane, desk: QuoteDesk, id: string, actor?: PublicUser): Promise<QuoteRecord> {
    const result = await this.ready().returnQuote(lane, desk, id);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy báo giá");
    if (result === "state") throw new AppError(409, "CONFLICT", "Báo giá chưa được vận hành gửi");
    if (actor) {
      await this.notifications?.notifyQuoteReturned(
        actor,
        lane,
        desk,
        result.code,
        result.id,
        result.customerKind,
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
      .filter((quote) => quote.customerKind !== "SOURCING_LOGISTICS" || !covered.has(quote.id))
      .map((quote) => ({ ...quote, desk: "logistics" as const }));
    return [...sourcingRows, ...logisticsRows].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createContract(
    lane: CrmLane,
    quoteId: string,
    input: CreateContractInput,
    actor?: PublicUser,
  ): Promise<ContractRecord> {
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
    if (result === "invalid") throw new AppError(400, "VALIDATION", "Số tiền thanh toán không được lớn hơn tổng giá trị");
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
}
