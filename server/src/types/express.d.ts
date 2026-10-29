import type { PublicUser } from "@speego/shared";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: PublicUser;
      sessionId?: string;
    }
  }
}

export {};
