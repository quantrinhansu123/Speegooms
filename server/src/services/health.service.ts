import type { UserRepository } from "../repositories/user.repository";

export class HealthService {
  constructor(private readonly users: UserRepository) {}

  async ping(): Promise<void> {
    await this.users.ping();
  }
}
