import type { Request, Response } from "express";
import type { HealthService } from "../services/health.service";

export class HealthController {
  constructor(private readonly health: HealthService) {}

  show = async (_req: Request, res: Response) => {
    await this.health.ping();
    res.status(200).json({ status: "ok" });
  };
}
