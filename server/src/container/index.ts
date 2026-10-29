import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import type { Env } from "../config/env";
import { getPostgresPool } from "../adapters/postgres/pool";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { PostgresNotificationRepository } from "../adapters/postgres/notification.repository";
import { AuthController } from "../controllers/auth.controller";
import { CrmController } from "../controllers/crm.controller";
import { HealthController } from "../controllers/health.controller";
import { NotificationController } from "../controllers/notification.controller";
import { SecurityController } from "../controllers/security.controller";
import { UserAdminController } from "../controllers/user-admin.controller";
import { createSessionCookies } from "../lib/cookies";
import { createAuthenticate } from "../middlewares/authenticate";
import { createCsrfGuard, type CsrfGuard } from "../middlewares/csrf";
import { createRepositories } from "../repositories/create-repositories";
import { AuthService } from "../services/auth.service";
import { CrmService } from "../services/crm.service";
import { HealthService } from "../services/health.service";
import { NotificationService } from "../services/notification.service";
import { ScryptPasswordHasher } from "../services/password.service";
import { UserAdminService } from "../services/user-admin.service";

/**
 * Composition root. Đây là nơi duy nhất tạo adapter và tiêm vào service.
 * Controller và service không tự new repository.
 */
export interface AppContainer {
  env: Env;
  authController: AuthController;
  healthController: HealthController;
  securityController: SecurityController;
  userAdminController: UserAdminController;
  crmController: CrmController;
  notificationController: NotificationController;
  authenticate: RequestHandler;
  csrf: CsrfGuard;
  close(): Promise<void>;
}

export async function createContainer(env: Env): Promise<AppContainer> {
  const repositories = await createRepositories(env);
  const passwords = new ScryptPasswordHasher();
  const dummyHash = await passwords.hash(randomBytes(16).toString("hex"));
  const auth = new AuthService(repositories.users, repositories.sessions, passwords, dummyHash);
  const cookies = createSessionCookies(env);
  const csrf = createCsrfGuard(env);
  const pool = env.DB_PROVIDER === "postgres" ? getPostgresPool(env) : null;
  const crm = pool ? new PostgresCrmRepository(pool) : null;
  const notifications = pool ? new PostgresNotificationRepository(pool) : null;
  const notificationService = new NotificationService(notifications);

  return {
    env,
    authController: new AuthController(auth, cookies),
    healthController: new HealthController(new HealthService(repositories.users)),
    securityController: new SecurityController(csrf.issue),
    userAdminController: new UserAdminController(new UserAdminService(repositories.users)),
    crmController: new CrmController(new CrmService(crm, notificationService)),
    notificationController: new NotificationController(notificationService),
    authenticate: createAuthenticate(env, repositories.users, repositories.sessions),
    csrf,
    close: () => repositories.close(),
  };
}
