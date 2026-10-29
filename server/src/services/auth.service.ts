import { loginSchema, type PublicUser } from "@speego/shared";
import { AppError } from "../lib/errors";
import { isSessionId } from "../lib/session-id";
import { toPublicUser } from "../models/user.model";
import type { SessionRepository } from "../repositories/session.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { PasswordHasher } from "./password.service";

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const INVALID_LOGIN = "Email hoặc mật khẩu không đúng";

export interface LoginResult {
  user: PublicUser;
  sessionId: string;
  maxAgeMs: number;
}

export interface AuthUseCases {
  login(input: unknown): Promise<LoginResult>;
  logout(sessionId: string | undefined): Promise<void>;
}

export class AuthService implements AuthUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordHasher,
    private readonly dummyHash: string,
  ) {}

  async login(input: unknown): Promise<LoginResult> {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ");
    }
    const email = parsed.data.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    const ok = await this.passwords.verify(parsed.data.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !ok) {
      throw new AppError(401, "INVALID_CREDENTIALS", INVALID_LOGIN);
    }
    const maxAgeMs = parsed.data.remember ? THIRTY_DAYS_MS : EIGHT_HOURS_MS;
    const sessionId = await this.sessions.create({
      userId: user.id,
      expiresAt: new Date(Date.now() + maxAgeMs),
    });
    return { user: toPublicUser(user), sessionId, maxAgeMs };
  }

  async logout(sessionId: string | undefined): Promise<void> {
    if (!sessionId || !isSessionId(sessionId)) return;
    await this.sessions.revoke(sessionId);
  }
}
