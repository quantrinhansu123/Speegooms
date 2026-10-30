import type { CrmLane, QuoteDesk } from "@speego/shared";
import type { Request, Response } from "express";
import { can } from "../config/permissions";
import { AppError } from "../lib/errors";
import type { ContractView } from "../repositories/crm.repository";
import { readContractSearch, readMessageSearch, readPotentialSearch, readQuoteDeskFilter, readQuoteSearch } from "../search/parse-list-search";
import type { CrmService } from "../services/crm.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !UUID.test(id)) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
  return id;
}

function laneOf(req: Request): CrmLane {
  const raw = req.query.lane;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value !== "vn" && value !== "global") {
    throw new AppError(400, "VALIDATION_ERROR", "Chọn tuyến Việt Nam hoặc Global");
  }
  const role = req.user?.role;
  if (role === "sale-vn" && value !== "vn") throw new AppError(403, "FORBIDDEN", "Sale Việt Nam chỉ thao tác tuyến Việt Nam");
  if (role === "sale-global" && value !== "global") throw new AppError(403, "FORBIDDEN", "Sale Global chỉ thao tác tuyến Global");
  return value;
}

function deskOf(req: Request): QuoteDesk {
  const raw = req.query.desk;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value !== "sourcing" && value !== "logistics") {
    throw new AppError(400, "VALIDATION_ERROR", "Chọn bàn Sourcing hoặc Logistics");
  }
  return value;
}

export class CrmController {
  constructor(private readonly crm: CrmService) {}

  listMessages = async (req: Request, res: Response) => {
    res.status(200).json({ messages: await this.crm.listMessages(laneOf(req), readMessageSearch(req)) });
  };

  createMessage = async (req: Request, res: Response) => {
    res.status(201).json({ message: await this.crm.createMessage(laneOf(req), req.body) });
  };

  updateMessage = async (req: Request, res: Response) => {
    res.status(200).json({ message: await this.crm.updateMessage(laneOf(req), one(req.params.id), req.body) });
  };

  deleteMessage = async (req: Request, res: Response) => {
    await this.crm.deleteMessage(laneOf(req), one(req.params.id));
    res.status(204).end();
  };

  convertMessage = async (req: Request, res: Response) => {
    res.status(200).json(await this.crm.convertMessage(laneOf(req), one(req.params.id)));
  };

  listPotentials = async (req: Request, res: Response) => {
    res.status(200).json({ potentials: await this.crm.listPotentials(laneOf(req), readPotentialSearch(req)) });
  };

  updatePotential = async (req: Request, res: Response) => {
    res.status(200).json({ potential: await this.crm.updatePotential(laneOf(req), one(req.params.id), req.body) });
  };

  deletePotential = async (req: Request, res: Response) => {
    await this.crm.deletePotential(laneOf(req), one(req.params.id));
    res.status(204).end();
  };

  listQuotes = async (req: Request, res: Response) => {
    res.status(200).json({ quotes: await this.crm.listQuotes(laneOf(req), deskOf(req), readQuoteSearch(req)) });
  };

  listRfqQuotes = async (req: Request, res: Response) => {
    res.status(200).json({ quotes: await this.crm.listRfqQuotes(laneOf(req), readQuoteSearch(req), readQuoteDeskFilter(req)) });
  };

  reassignRfqQuote = async (req: Request, res: Response) => {
    res.status(200).json({ quote: await this.crm.reassignRfqQuote(laneOf(req), one(req.params.id), req.body.potentialId) });
  };

  deleteRfqQuote = async (req: Request, res: Response) => {
    await this.crm.deleteRfqQuote(laneOf(req), one(req.params.id));
    res.status(204).end();
  };

  requestQuote = async (req: Request, res: Response) => {
    res.status(200).json(await this.crm.requestQuote(laneOf(req), one(req.params.id), req.user));
  };

  requestLogisticsQuote = async (req: Request, res: Response) => {
    res.status(200).json(await this.crm.requestLogisticsQuote(laneOf(req), one(req.params.id)));
  };

  updateQuote = async (req: Request, res: Response) => {
    const role = req.user?.role;
    const contentOnly = Boolean(role && can(role, "quote.content") && !can(role, "quote.ops"));
    res.status(200).json({
      quote: await this.crm.updateQuote(laneOf(req), deskOf(req), one(req.params.id), req.body, { contentOnly }),
    });
  };

  sendQuote = async (req: Request, res: Response) => {
    res.status(200).json({ quote: await this.crm.sendQuote(laneOf(req), deskOf(req), one(req.params.id), req.body, req.user) });
  };

  returnQuote = async (req: Request, res: Response) => {
    res.status(200).json({ quote: await this.crm.returnQuote(laneOf(req), deskOf(req), one(req.params.id), req.user) });
  };

  listQuoteTemplates = async (req: Request, res: Response) => {
    res.status(200).json({ templates: await this.crm.listQuoteTemplates(deskOf(req)) });
  };

  createQuoteTemplate = async (req: Request, res: Response) => {
    res.status(201).json({ template: await this.crm.createQuoteTemplate(deskOf(req), req.body) });
  };

  updateQuoteTemplate = async (req: Request, res: Response) => {
    res.status(200).json({ template: await this.crm.updateQuoteTemplate(deskOf(req), one(req.params.id), req.body) });
  };

  deleteQuoteTemplate = async (req: Request, res: Response) => {
    await this.crm.deleteQuoteTemplate(deskOf(req), one(req.params.id));
    res.status(204).end();
  };

  listContracts = async (req: Request, res: Response) => {
    const view = contractView(req);
    const sentOnly = req.query.sent === "1" || view === "accounting";
    res.status(200).json({ contracts: await this.crm.listContracts(laneOf(req), sentOnly, view, readContractSearch(req)) });
  };

  createContract = async (req: Request, res: Response) => {
    res.status(201).json({ contract: await this.crm.createContract(laneOf(req), one(req.params.id), req.body, req.user) });
  };

  updateOpsContract = async (req: Request, res: Response) => {
    res.status(200).json({ contract: await this.crm.updateOpsContract(laneOf(req), one(req.params.id), req.body) });
  };

  updateAccountingContract = async (req: Request, res: Response) => {
    res.status(200).json({ contract: await this.crm.updateAccountingContract(laneOf(req), one(req.params.id), req.body) });
  };

  deleteContract = async (req: Request, res: Response) => {
    await this.crm.deleteContract(laneOf(req), one(req.params.id));
    res.status(204).end();
  };

  updateCommercialContract = async (req: Request, res: Response) => {
    res.status(200).json({ contract: await this.crm.updateCommercialContract(laneOf(req), one(req.params.id), req.body) });
  };

  resendContract = async (req: Request, res: Response) => {
    res.status(200).json({ contract: await this.crm.resendContract(laneOf(req), one(req.params.id), resendTarget(req), req.user) });
  };
}

function contractView(req: Request): ContractView {
  const raw = req.query.view;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const role = req.user?.role;
  const allowed = (candidate: ContractView) => {
    if (candidate === "sale") return role === "admin" || role === "sale-vn" || role === "sale-global";
    if (candidate === "ops") return role === "admin" || role === "van-hanh";
    return role === "admin" || role === "ke-toan";
  };
  if (value === "sale" || value === "ops" || value === "accounting") {
    if (!allowed(value)) throw new AppError(403, "FORBIDDEN", "Không xem hợp đồng ở bên này");
    return value;
  }
  if (role === "ke-toan") return "accounting";
  if (role === "van-hanh") return "ops";
  if (role === "sale-vn" || role === "sale-global" || role === "admin") return "sale";
  throw new AppError(403, "FORBIDDEN", "Không xem hợp đồng ở bên này");
}

function resendTarget(req: Request): "ops" | "accounting" | "parties" {
  const raw = req.query.to;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const role = req.user?.role;
  if (value === "ops" && (role === "admin" || role === "sale-vn" || role === "sale-global")) return "ops";
  if (value === "accounting" && (role === "admin" || role === "van-hanh")) return "accounting";
  if (value === "parties" && role === "ke-toan") return "parties";
  throw new AppError(403, "FORBIDDEN", "Không gửi lại hợp đồng cho bên này");
}
