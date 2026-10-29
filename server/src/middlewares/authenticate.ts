import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/async-handler";
import { isSessionId } from "../lib/session-id";
import { toPublicUser } from "../models/user.model";
import type { SessionRepository } from "../repositories/session.repository";
import type { UserRepository } from "../repositories/user.repository";
import { sessionCookieName } from "../lib/cookies";
import type { Env } from "../config/env";

export function createAuthenticate(env: Env, users: UserRepository, sessions: SessionRepository) {
  const cookieName = sessionCookieName(env);
  return asyncHandler(async (req, _res, next) => {
    const raw = req.cookies?.[cookieName];
    if (typeof raw !== "string" || !isSessionId(raw)) {
      throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    }
    const session = await sessions.findValid(raw);
    if (!session) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    const user = await users.findById(session.userId);
    if (!user) {
      await sessions.revoke(raw);
      throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
    }
    req.user = toPublicUser(user);
    req.sessionId = raw;
    next();
  });
}
