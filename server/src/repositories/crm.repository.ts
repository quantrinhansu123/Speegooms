import type { CreateMessageInput, UpdateMessageInput, UpdatePotentialInput } from "@speego/shared";

export interface MessageRecord {
  id: string;
  messCode: string;
  source: string;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  goods: string | null;
  demand: string | null;
  customerType: string | null;
  note: string | null;
  receivedAt: string;
  leadId: string | null;
  leadCode: string | null;
}

export interface PotentialRecord {
  id: string;
  leadCode: string;
  messId: string | null;
  messCode: string | null;
  fullName: string | null;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  productInterest: string | null;
  quantityNote: string | null;
  address: string | null;
  saleNote: string | null;
  potential: string;
  status: string;
  customerKind: string | null;
  customerType: string | null;
  brand: string | null;
  createdAt: string;
}

export interface CrmRepository {
  listMessages(): Promise<MessageRecord[]>;
  createMessage(input: CreateMessageInput): Promise<MessageRecord>;
  updateMessage(id: string, input: UpdateMessageInput): Promise<MessageRecord | null>;
  deleteMessage(id: string): Promise<"ok" | "missing" | "linked">;
  convertMessage(id: string): Promise<{ message: MessageRecord; potential: PotentialRecord } | "missing" | "lost">;
  listPotentials(): Promise<PotentialRecord[]>;
  updatePotential(id: string, input: UpdatePotentialInput): Promise<PotentialRecord | null>;
  deletePotential(id: string): Promise<boolean>;
}
