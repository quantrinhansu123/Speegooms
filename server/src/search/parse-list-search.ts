import {
  customerKindSchema,
  customerTypeSchema,
  leadSourceSchema,
  listSearchSchema,
  messageClassificationSchema,
  messageDemandSchema,
  opsStatusOptions,
  potentialStatusSchema,
  quoteStatusSchema,
  contractQuoteStatusSchema,
  type ListSearch,
} from "@speego/shared";
import type { Request } from "express";
import { AppError } from "../lib/errors";
import type { ContractListSearch, MessageListSearch, PotentialListSearch, QuoteListSearch } from "./crm-list-search";

const messageStatuses = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST", "DORMANT"] as const;
const accountingStatuses = ["DA_HOAN_THANH_COC", "DA_HOAN_THANH_THANH_TOAN", "CHUA_HOAN_THANH_COC", "CHUA_HOAN_THANH_THANH_TOAN"] as const;
const quoteDesks = ["sourcing", "logistics"] as const;

function queryText(req: Request, key: string): string {
  const raw = req.query[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : "";
}

function oneOf(req: Request, key: string, allowed: readonly string[]): string {
  const value = queryText(req, key).trim();
  if (!value) return "";
  if (!allowed.includes(value)) throw new AppError(400, "VALIDATION_ERROR", "Bộ lọc không hợp lệ");
  return value;
}

function readListSearch(req: Request): ListSearch {
  const parsed = listSearchSchema.safeParse({
    q: queryText(req, "q"),
    from: queryText(req, "from"),
    to: queryText(req, "to"),
  });
  if (!parsed.success) {
    throw new AppError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Bộ lọc không hợp lệ");
  }
  return parsed.data;
}

export function readMessageSearch(req: Request): MessageListSearch {
  return {
    ...readListSearch(req),
    status: oneOf(req, "status", messageStatuses),
    classification: oneOf(req, "classification", messageClassificationSchema.options),
    demand: oneOf(req, "demand", messageDemandSchema.options),
    customerType: oneOf(req, "customerType", customerTypeSchema.options),
  };
}

export function readPotentialSearch(req: Request): PotentialListSearch {
  return {
    ...readListSearch(req),
    source: oneOf(req, "source", leadSourceSchema.options),
    potential: oneOf(req, "potential", potentialStatusSchema.options),
    customerKind: oneOf(req, "customerKind", customerKindSchema.options),
    customerType: oneOf(req, "customerType", customerTypeSchema.options),
  };
}

export function readQuoteSearch(req: Request): QuoteListSearch {
  return {
    ...readListSearch(req),
    quoteStatus: oneOf(req, "quoteStatus", quoteStatusSchema.options),
    contractStatus: oneOf(req, "contractStatus", contractQuoteStatusSchema.options),
    customerKind: oneOf(req, "customerKind", customerKindSchema.options),
  };
}

export function readQuoteDeskFilter(req: Request): "" | "sourcing" | "logistics" {
  const value = oneOf(req, "deskFilter", quoteDesks);
  return value === "sourcing" || value === "logistics" ? value : "";
}

export function readContractSearch(req: Request): ContractListSearch {
  return {
    ...readListSearch(req),
    opsStatus: oneOf(req, "opsStatus", opsStatusOptions),
    accountingStatus: oneOf(req, "accountingStatus", accountingStatuses),
  };
}
