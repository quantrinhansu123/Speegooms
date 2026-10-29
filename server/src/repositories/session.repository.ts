export interface SessionRepository {
  /** Trả session id thô để đặt cookie. DB chỉ lưu hash. */
  create(input: { userId: string; expiresAt: Date }): Promise<string>;
  findValid(sessionId: string): Promise<{ userId: string } | null>;
  revoke(sessionId: string): Promise<void>;
}
