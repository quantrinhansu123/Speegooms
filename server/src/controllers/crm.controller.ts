import type { CrmLane, QuoteDesk } from "@speego/shared";
import type { Request, Response } from "express";
import { AppError } from "../lib/errors";
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
    res.status(200).json({ messages: await this.crm.listMessages(laneOf(req)) });
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
    res.status(200).json({ potentials: await this.crm.listPotentials(laneOf(req)) });
  };

  updatePotential = async (req: Request, res: Response) => {
    res.status(200).json({ potential: await this.crm.updatePotential(laneOf(req), one(req.params.id), req.body) });
  };

  deletePotential = async (req: Request, res: Response) => {
    await this.crm.deletePotential(laneOf(req), one(req.params.id));
    res.status(204).end();
  };

  listQuotes = async (req: Request, res: Response) => {
    res.status(200).json({ quotes: await this.crm.listQuotes(laneOf(req), deskOf(req)) });
  };

  listRfqQuotes = async (req: Request, res: Response) => {
    res.status(200).json({ quotes: await this.crm.listRfqQuotes(laneOf(req)) });
  };

  reassignRfqQuote = async (req: Request, res: Response) => {
    res.status(200).json({ quote: await this.crm.reassignRfqQuote(laneOf(req), one(req.params.id), req.body.potentialId) });
  };

  deleteRfqQuote = async (req: Request, res: Response) => {
    await this.crm.deleteRfqQuote(laneOf(req), one(req.params.id));
    res.status(204).end();
  };

  requestQuote = async (req: Request, res: Response) => {
    res.status(200).json(await this.crm.requestQuote(laneOf(req), one(req.params.id)));
  };

  requestLogisticsQuote = async (req: Request, res: Response) => {
    res.status(200).json(await this.crm.requestLogisticsQuote(laneOf(req), one(req.params.id)));
  };

  updateQuote = async (req: Request, res: Response) => {
    res.status(200).json({ quote: await this.crm.updateQuote(laneOf(req), deskOf(req), one(req.params.id), req.body) });
  };

  sendQuote = async (req: Request, res: Response) => {
    res.status(200).json({ quote: await this.crm.sendQuote(laneOf(req), deskOf(req), one(req.params.id), req.body) });
  };

  returnQuote = async (req: Request, res: Response) => {
    res.status(200).json({ quote: await this.crm.returnQuote(laneOf(req), deskOf(req), one(req.params.id)) });
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
}
