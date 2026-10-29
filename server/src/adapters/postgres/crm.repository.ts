import type { CreateMessageInput, UpdateMessageInput, UpdatePotentialInput } from "@speego/shared";
import type pg from "pg";
import { AppError, InfrastructureError } from "../../lib/errors";
import type { CrmRepository, MessageRecord, PotentialRecord } from "../../repositories/crm.repository";

type MessageRow = {
  id: string;
  mess_code: string;
  source: string;
  customer_name_raw: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  goods: string | null;
  demand: string | null;
  customer_type: string | null;
  note: string | null;
  received_at: Date | string;
  lead_id: string | null;
  lead_code: string | null;
};

type PotentialRow = {
  id: string;
  lead_code: string;
  mess_id: string | null;
  mess_code: string | null;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  product_interest: string | null;
  quantity_note: string | null;
  address: string | null;
  sale_note: string | null;
  potential: string;
  status: string;
  customer_kind: string | null;
  customer_type: string | null;
  brand: string | null;
  created_at: Date | string;
};

const MESSAGE_SELECT = `
  select m.id::text, m.mess_code, m.source::text, m.customer_name_raw, m.phone, m.email,
         m.status::text, m.goods, m.demand::text, m.customer_type::text, m.note, m.received_at,
         l.id::text as lead_id, l.lead_code
  from crm.message m
  left join crm.lead l on l.mess_id = m.id and l.deleted_at is null
`;

const POTENTIAL_SELECT = `
  select l.id::text, l.lead_code, l.mess_id::text, m.mess_code, l.full_name, l.company_name,
         l.phone, l.email, l.source::text, l.product_interest, l.quantity_note, l.address, l.sale_note,
         l.potential::text, l.status::text, l.customer_kind::text, l.customer_type::text, l.brand::text, l.created_at
  from crm.lead l
  left join crm.message m on m.id = l.mess_id
  where l.deleted_at is null and l.potential is not null
`;

function blank(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

function stamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    messCode: row.mess_code,
    source: row.source,
    customerName: row.customer_name_raw,
    phone: row.phone,
    email: row.email,
    status: row.status,
    goods: row.goods,
    demand: row.demand,
    customerType: row.customer_type,
    note: row.note,
    receivedAt: stamp(row.received_at),
    leadId: row.lead_id,
    leadCode: row.lead_code,
  };
}

function toPotential(row: PotentialRow): PotentialRecord {
  return {
    id: row.id,
    leadCode: row.lead_code,
    messId: row.mess_id,
    messCode: row.mess_code,
    fullName: row.full_name,
    companyName: row.company_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    productInterest: row.product_interest,
    quantityNote: row.quantity_note,
    address: row.address,
    saleNote: row.sale_note,
    potential: row.potential,
    status: row.status,
    customerKind: row.customer_kind,
    customerType: row.customer_type,
    brand: row.brand,
    createdAt: stamp(row.created_at),
  };
}

function raise(cause: unknown): never {
  if (cause instanceof AppError) throw cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = String((cause as { code: unknown }).code);
    const message = String((cause as { message?: unknown }).message ?? "").split("\n")[0] ?? "";
    if (code === "23505") throw new AppError(409, "CONFLICT", "Dữ liệu bị trùng");
    if (code === "23503") throw new AppError(409, "CONFLICT", "Mess đang gắn với khách hàng tiềm năng");
    if (code === "23514" || code === "42501") throw new AppError(400, "RULE", message.slice(0, 200) || "Dữ liệu không hợp lệ");
    if (code === "22P02") throw new AppError(400, "VALIDATION_ERROR", "Giá trị không hợp lệ");
  }
  throw new InfrastructureError("database query failed", { cause });
}

export class PostgresCrmRepository implements CrmRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listMessages(): Promise<MessageRecord[]> {
    const result = await this.query<MessageRow>(`${MESSAGE_SELECT} order by m.received_at desc limit 200`);
    return result.rows.map(toMessage);
  }

  async createMessage(input: CreateMessageInput): Promise<MessageRecord> {
    const inserted = await this.query<{ id: string }>(
      `insert into crm.message (customer_name_raw, phone, email, goods, demand, customer_type, note)
       values ($1, $2, $3, $4, $5::text::crm.message_demand, $6::text::crm.customer_type, $7)
       returning id::text`,
      [
        input.customerName,
        blank(input.phone),
        blank(input.email),
        blank(input.goods),
        input.demand ?? null,
        input.customerType ?? null,
        blank(input.note),
      ],
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new InfrastructureError("insert message returned no row");
    const row = await this.findMessage(id);
    if (!row) throw new InfrastructureError("message missing after insert");
    return row;
  }

  async updateMessage(id: string, input: UpdateMessageInput): Promise<MessageRecord | null> {
    const updated = await this.query<{ id: string }>(
      `update crm.message set
         customer_name_raw = $2,
         phone = $3,
         email = $4,
         goods = $5,
         demand = $6::text::crm.message_demand,
         customer_type = $7::text::crm.customer_type,
         note = $8
       where id = $1::bigint
       returning id::text`,
      [id, input.customerName, blank(input.phone), blank(input.email), blank(input.goods), input.demand ?? null, input.customerType ?? null, blank(input.note)],
    );
    if (!updated.rows[0]) return null;
    await this.query(
      `update crm.lead set
         full_name = $2,
         phone = $3,
         email = $4,
         product_interest = $5
       where mess_id = $1::bigint and deleted_at is null`,
      [id, input.customerName, blank(input.phone), blank(input.email), blank(input.goods)],
    );
    return this.findMessage(id);
  }

  async deleteMessage(id: string): Promise<"ok" | "missing" | "linked"> {
    return this.transaction(async (client) => {
      const found = await client.query(`select id from crm.message where id = $1::bigint`, [id]);
      if (!found.rowCount) return "missing";
      const linked = await client.query(`select 1 from crm.lead where mess_id = $1::bigint`, [id]);
      if (linked.rowCount) return "linked";
      await client.query(`delete from crm.message where id = $1::bigint`, [id]);
      return "ok";
    });
  }

  async convertMessage(id: string): Promise<{ message: MessageRecord; potential: PotentialRecord } | "missing" | "lost"> {
    return this.transaction(async (client) => {
      const locked = await client.query<{ status: string; source: string; customer_name_raw: string | null; phone: string | null; email: string | null; goods: string | null; demand: string | null; customer_type: string | null; note: string | null }>(
        `select status::text, source::text, customer_name_raw, phone, email, goods, demand::text, customer_type::text, note
         from crm.message where id = $1::bigint for update`,
        [id],
      );
      const message = locked.rows[0];
      if (!message) return "missing";
      if (message.status === "LOST") return "lost";

      const existing = await client.query<PotentialRow>(
        `${POTENTIAL_SELECT} and l.mess_id = $1::bigint`,
        [id],
      );
      let potential = existing.rows[0];
      if (!potential) {
        const kind = message.demand === "SHIPPING" ? "LOGISTICS" : message.demand === "SOURCING" ? "SOURCING" : null;
        const inserted = await client.query<{ id: string }>(
          `insert into crm.lead (
             source, full_name, phone, email, product_interest, potential, status, mess_id,
             customer_kind, customer_type, sale_note
           )
           values (
             $2::crm.lead_source, $3, $4, $5, $6, 'POTENTIAL'::crm.potential_status, 'NEW', $1::bigint,
             $7::text::crm.customer_kind, $8::text::crm.customer_type, $9
           )
           returning id::text`,
          [id, message.source, message.customer_name_raw, message.phone, message.email, message.goods, kind, message.customer_type, message.note],
        );
        const leadId = inserted.rows[0]?.id;
        if (!leadId) throw new InfrastructureError("insert lead returned no row");
        const loaded = await client.query<PotentialRow>(`${POTENTIAL_SELECT} and l.id = $1::bigint`, [leadId]);
        potential = loaded.rows[0];
        if (!potential) throw new InfrastructureError("lead missing after insert");
      }

      if (message.status !== "CONVERTED") {
        await client.query(`update crm.message set status = 'CONVERTED' where id = $1::bigint`, [id]);
      }

      const refreshed = await client.query<MessageRow>(`${MESSAGE_SELECT} where m.id = $1::bigint`, [id]);
      const row = refreshed.rows[0];
      if (!row) throw new InfrastructureError("message missing after convert");
      return { message: toMessage(row), potential: toPotential(potential) };
    });
  }

  async listPotentials(): Promise<PotentialRecord[]> {
    const result = await this.query<PotentialRow>(`${POTENTIAL_SELECT} order by l.created_at desc limit 200`);
    return result.rows.map(toPotential);
  }

  async updatePotential(id: string, input: UpdatePotentialInput): Promise<PotentialRecord | null> {
    const updated = await this.query<{ id: string }>(
      `update crm.lead set
         full_name = $2,
         company_name = $3,
         phone = $4,
         email = $5,
         product_interest = $6,
         quantity_note = $7,
         address = $8,
         sale_note = $9,
         potential = $10::crm.potential_status,
         customer_kind = $11::text::crm.customer_kind,
         customer_type = $12::text::crm.customer_type,
         brand = $13::text::crm.lead_brand
       where id = $1::bigint and deleted_at is null and potential is not null
       returning id::text`,
      [
        id,
        input.fullName,
        blank(input.companyName),
        blank(input.phone),
        blank(input.email),
        blank(input.productInterest),
        blank(input.quantityNote),
        blank(input.address),
        blank(input.saleNote),
        input.potential,
        input.customerKind ?? null,
        input.customerType ?? null,
        input.brand ?? null,
      ],
    );
    if (!updated.rows[0]) return null;
    const result = await this.query<PotentialRow>(`${POTENTIAL_SELECT} and l.id = $1::bigint`, [id]);
    const row = result.rows[0];
    return row ? toPotential(row) : null;
  }

  async deletePotential(id: string): Promise<boolean> {
    return this.transaction(async (client) => {
      const removed = await client.query<{ mess_id: string | null }>(
        `with old as (
           select id, mess_id from crm.lead where id = $1::bigint and deleted_at is null and potential is not null
         )
         update crm.lead l
         set deleted_at = now(), mess_id = null
         from old
         where l.id = old.id
         returning old.mess_id::text`,
        [id],
      );
      const messId = removed.rows[0]?.mess_id;
      if (!removed.rowCount) return false;
      if (messId) {
        await client.query(
          `update crm.message set status = 'QUALIFIED'
           where id = $1::bigint
             and status = 'CONVERTED'
             and not exists (
               select 1 from crm.lead where mess_id = $1::bigint and deleted_at is null
             )`,
          [messId],
        );
      }
      return true;
    });
  }

  private async findMessage(id: string): Promise<MessageRecord | null> {
    const result = await this.query<MessageRow>(`${MESSAGE_SELECT} where m.id = $1::bigint`, [id]);
    const row = result.rows[0];
    return row ? toMessage(row) : null;
  }

  private async query<T extends pg.QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<pg.QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, [...params]);
    } catch (cause) {
      raise(cause);
    }
  }

  private async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (cause) {
      await client.query("rollback");
      raise(cause);
    } finally {
      client.release();
    }
  }
}
