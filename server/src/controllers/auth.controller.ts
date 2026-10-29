import type { Request, Response } from "express";
import type { createSessionCookies } from "../lib/cookies";
import type { AuthUseCases } from "../services/auth.service";

export class AuthController {
  constructor(
    private readonly auth: AuthUseCases,
    private readonly cookies: ReturnType<typeof createSessionCookies>,
  ) {}

  login = async (req: Request, res: Response) => {
    const result = await this.auth.login(req.body);
    this.cookies.set(res, result.sessionId, result.maxAgeMs);
    res.status(200).json({ user: result.user });
  };

  logout = async (req: Request, res: Response) => {
    const raw = req.cookies?.[this.cookies.name];
    await this.auth.logout(typeof raw === "string" ? raw : undefined);
    this.cookies.clear(res);
    res.status(204).end();
  };

  me = (req: Request, res: Response) => {
    res.status(200).json({ user: req.user });
  };
}
