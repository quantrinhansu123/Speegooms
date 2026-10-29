import type { Request, Response } from "express";
import { AppError } from "../lib/errors";
import type { CrmService } from "../services/crm.service";

function one(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !/^\d{1,18}$/.test(id)) throw new AppError(404, "NOT_FOUND", "Không tìm thấy");
  return id;
}

export class CrmController {
  constructor(private readonly crm: CrmService) {}

  listMessages = async (_req: Request, res: Response) => {
    res.status(200).json({ messages: await this.crm.listMessages() });
  };

  createMessage = async (req: Request, res: Response) => {
    res.status(201).json({ message: await this.crm.createMessage(req.body) });
  };

  updateMessage = async (req: Request, res: Response) => {
    res.status(200).json({ message: await this.crm.updateMessage(one(req.params.id), req.body) });
  };

  deleteMessage = async (req: Request, res: Response) => {
    await this.crm.deleteMessage(one(req.params.id));
    res.status(204).end();
  };

  convertMessage = async (req: Request, res: Response) => {
    res.status(200).json(await this.crm.convertMessage(one(req.params.id)));
  };

  listPotentials = async (_req: Request, res: Response) => {
    res.status(200).json({ potentials: await this.crm.listPotentials() });
  };

  updatePotential = async (req: Request, res: Response) => {
    res.status(200).json({ potential: await this.crm.updatePotential(one(req.params.id), req.body) });
  };

  deletePotential = async (req: Request, res: Response) => {
    await this.crm.deletePotential(one(req.params.id));
    res.status(204).end();
  };
}
