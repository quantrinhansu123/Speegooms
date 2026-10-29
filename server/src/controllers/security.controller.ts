import type { Request, Response } from "express";

export class SecurityController {
  constructor(private readonly issue: (res: Response) => string) {}

  token = (_req: Request, res: Response) => {
    res.status(200).json({ token: this.issue(res) });
  };
}
