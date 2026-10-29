import type { UserDirectory } from "../repositories/user.repository";
import { demoUsers } from "../seeds/demo-users";
import type { PasswordHasher } from "../services/password.service";

export async function seedDemoUsers(directory: UserDirectory, hasher: PasswordHasher, password: string): Promise<void> {
  const passwordHash = await hasher.hash(password);
  for (const user of demoUsers) {
    await directory.upsert({
      ...user,
      email: user.email.toLowerCase(),
      passwordHash,
    });
  }
}
