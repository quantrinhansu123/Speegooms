import type { Response } from "express";
import type { Env } from "../config/env";

export function sessionCookieName(env: Env): string {
  return env.NODE_ENV === "production" ? "__Host-speego_session" : "speego_session";
}

export function createSessionCookies(env: Env) {
  const name = sessionCookieName(env);
  const base = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  return {
    name,
    set(res: Response, sessionId: string, maxAgeMs: number) {
      res.cookie(name, sessionId, { ...base, maxAge: maxAgeMs });
    },
    clear(res: Response) {
      res.clearCookie(name, base);
    },
  };
}
