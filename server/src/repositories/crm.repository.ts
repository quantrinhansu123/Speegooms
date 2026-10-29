import type {
  ContractListSearch,
  MessageListSearch,
  PotentialListSearch,
  QuoteListSearch,
} from "../search/crm-list-search";
import type {
  AccountingContractInput,
  CreateContractInput,
  CreateMessageInput,
  CrmLane,
  OpsContractInput,
  QuoteBank,
  QuoteDesk,
  QuoteNotes,
  QuoteOrder,
  SentQuote,
  QuoteTemplateInput,
  UpdateMessageInput,
  UpdatePotentialInput,
  UpdateQuoteInput,
} from "@speego/shared";

export type { CrmLane, QuoteDesk };

export type ContractView = "sale" | "ops" | "accounting";

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
  market: string | null;
  classification: string | null;
  saleName: string | null;
  painPoint: string | null;
  linkMess: string | null;
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
  careChannel: string | null;
  classification: string | null;
  packSpec: string | null;
  weightKg: number | null;
  logisticsClass: string | null;
  shipFromAddress: string | null;
  shipToAddress: string | null;
  createdAt: string;
}

export interface QuoteRecord {
  id: string;
  code: string;
  potentialId: string;
  leadCode: string;
  customerName: string | null;
  companyName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  customerKind: string | null;
  goods: string | null;
  templateId: string | null;
  templateName: string | null;
  opsNote: string | null;
  quoteStatus: string;
  contractStatus: string;
  orders: QuoteOrder[];
  notes: QuoteNotes;
  bank: QuoteBank;
  sentQuote: SentQuote | null;
  logisticsQuoteId: string | null;
  logisticsSheet: QuoteSheet | null;
  createdAt: string;
}

export interface QuoteSheet {
  templateId: string | null;
  templateName: string | null;
  opsNote: string | null;
  quoteStatus: string;
  contractStatus: string;
  orders: QuoteOrder[];
  notes: QuoteNotes;
  bank: QuoteBank;
  sentQuote: SentQuote | null;
}

export interface QuoteTemplateRecord {
  id: string;
  name: string;
  content: string | null;
  createdAt: string;
}

export interface RfqQuoteRecord extends QuoteRecord {
  desk: QuoteDesk;
}

export type ReassignQuoteResult = QuoteRecord | "missing" | "kind" | "desk" | "taken";

export type QuoteRequestResult =
  | { quote: QuoteRecord; created: boolean; desk: QuoteDesk }
  | "missing"
  | "kind";

export type LogisticsQuoteRequestResult =
  | { quote: QuoteRecord; created: boolean }
  | "missing"
  | "kind";

export interface ContractRecord {
  id: string;
  code: string;
  lane: CrmLane;
  quoteId: string;
  quoteCode: string;
  customerName: string;
  saleName: string | null;
  shipTo: string | null;
  product: string | null;
  quantity: number | null;
  productValue: number;
  shippingCost: number;
  totalValue: number;
  paidAmount: number;
  balance: number;
  signedOn: string | null;
  opsStatus: string;
  tracking: string;
  note1: string;
  note2: string;
  chinaWarehouseOn: string | null;
  containerOn: string | null;
  arrivalOn: string | null;
  deliveryOn: string | null;
  sentToAccountingAt: string | null;
  sentToOpsAt: string | null;
  confirmedBackAt: string | null;
  confirmedAmount: number | null;
  accountingStatus: string | null;
  images: string[];
  createdAt: string;
}

export interface CrmRepository {
  listMessages(lane: CrmLane, search: MessageListSearch): Promise<MessageRecord[]>;
  createMessage(lane: CrmLane, input: CreateMessageInput): Promise<MessageRecord>;
  updateMessage(lane: CrmLane, id: string, input: UpdateMessageInput): Promise<MessageRecord | null>;
  deleteMessage(lane: CrmLane, id: string): Promise<"ok" | "missing" | "linked">;
  convertMessage(lane: CrmLane, id: string): Promise<{ message: MessageRecord; potential: PotentialRecord } | "missing" | "lost">;
  listPotentials(lane: CrmLane, search: PotentialListSearch): Promise<PotentialRecord[]>;
  updatePotential(lane: CrmLane, id: string, input: UpdatePotentialInput): Promise<PotentialRecord | null>;
  deletePotential(lane: CrmLane, id: string): Promise<boolean>;
  listQuotes(lane: CrmLane, desk: QuoteDesk, search: QuoteListSearch): Promise<QuoteRecord[]>;
  listRfqQuotes(lane: CrmLane, search: QuoteListSearch, desk: "" | "sourcing" | "logistics"): Promise<RfqQuoteRecord[]>;
  reassignRfqQuote(lane: CrmLane, id: string, potentialId: string): Promise<ReassignQuoteResult>;
  deleteRfqQuote(lane: CrmLane, id: string): Promise<boolean>;
  requestQuote(lane: CrmLane, potentialId: string): Promise<QuoteRequestResult>;
  requestLogisticsQuote(lane: CrmLane, sourcingQuoteId: string): Promise<LogisticsQuoteRequestResult>;
  updateQuote(lane: CrmLane, desk: QuoteDesk, id: string, input: UpdateQuoteInput): Promise<QuoteRecord | "missing" | "template">;
  sendQuote(lane: CrmLane, desk: QuoteDesk, id: string, input: UpdateQuoteInput): Promise<QuoteRecord | "missing" | "empty" | "selection" | "template">;
  returnQuote(lane: CrmLane, desk: QuoteDesk, id: string): Promise<QuoteRecord | "missing" | "state">;
  listQuoteTemplates(desk: QuoteDesk): Promise<QuoteTemplateRecord[]>;
  createQuoteTemplate(desk: QuoteDesk, input: QuoteTemplateInput): Promise<QuoteTemplateRecord | "duplicate">;
  updateQuoteTemplate(desk: QuoteDesk, id: string, input: QuoteTemplateInput): Promise<QuoteTemplateRecord | "missing" | "duplicate">;
  deleteQuoteTemplate(desk: QuoteDesk, id: string): Promise<"ok" | "missing" | "used">;
  listContracts(lane: CrmLane, sentOnly: boolean, view: ContractView, search: ContractListSearch): Promise<ContractRecord[]>;
  createContract(lane: CrmLane, quoteId: string, input: CreateContractInput): Promise<ContractRecord | "missing">;
  updateOpsContract(lane: CrmLane, id: string, input: OpsContractInput): Promise<ContractRecord | "missing">;
  updateAccountingContract(lane: CrmLane, id: string, input: AccountingContractInput): Promise<ContractRecord | "missing" | "pending">;
  updateCommercialContract(lane: CrmLane, id: string, input: CreateContractInput): Promise<ContractRecord | "missing">;
  resendContract(lane: CrmLane, id: string, target: "ops" | "accounting" | "parties"): Promise<ContractRecord | "missing" | "pending">;
  deleteContract(lane: CrmLane, id: string): Promise<"ok" | "missing">;
}
