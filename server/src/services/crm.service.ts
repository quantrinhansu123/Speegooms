import type { CreateMessageInput, UpdateMessageInput, UpdatePotentialInput } from "@speego/shared";
import { AppError } from "../lib/errors";
import type { CrmRepository, MessageRecord, PotentialRecord } from "../repositories/crm.repository";

export class CrmService {
  constructor(private readonly crm: CrmRepository | null) {}

  listMessages(): Promise<MessageRecord[]> {
    return this.ready().listMessages();
  }

  createMessage(input: CreateMessageInput): Promise<MessageRecord> {
    return this.ready().createMessage(input);
  }

  async updateMessage(id: string, input: UpdateMessageInput): Promise<MessageRecord> {
    const row = await this.ready().updateMessage(id, input);
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
    return row;
  }

  async deleteMessage(id: string): Promise<void> {
    const result = await this.ready().deleteMessage(id);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
    if (result === "linked") throw new AppError(409, "CONFLICT", "Hãy xóa khách hàng tiềm năng của mess này trước");
  }

  async convertMessage(id: string): Promise<{ message: MessageRecord; potential: PotentialRecord }> {
    const result = await this.ready().convertMessage(id);
    if (result === "missing") throw new AppError(404, "NOT_FOUND", "Không tìm thấy mess");
    if (result === "lost") throw new AppError(409, "CONFLICT", "Mess đã mất, không chuyển được");
    return result;
  }

  listPotentials(): Promise<PotentialRecord[]> {
    return this.ready().listPotentials();
  }

  async updatePotential(id: string, input: UpdatePotentialInput): Promise<PotentialRecord> {
    const row = await this.ready().updatePotential(id, input);
    if (!row) throw new AppError(404, "NOT_FOUND", "Không tìm thấy khách hàng tiềm năng");
    return row;
  }

  async deletePotential(id: string): Promise<void> {
    const ok = await this.ready().deletePotential(id);
    if (!ok) throw new AppError(404, "NOT_FOUND", "Không tìm thấy khách hàng tiềm năng");
  }

  private ready(): CrmRepository {
    if (!this.crm) throw new AppError(503, "UNAVAILABLE", "CRM cần kết nối Postgres");
    return this.crm;
  }
}
