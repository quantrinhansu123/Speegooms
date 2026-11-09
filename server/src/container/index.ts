import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import type { Env } from "../config/env";
import { cloudinaryConfigFromParts, ensureCloudinary } from "../adapters/cloudinary/upload";
import { getPostgresPool } from "../adapters/postgres/pool";
import { PostgresCrmRepository } from "../adapters/postgres/crm.repository";
import { PostgresCrmImportStore } from "../adapters/postgres/crm-import.store";
import { PostgresDataLanhRepository } from "../adapters/postgres/data-lanh.repository";
import { PostgresKeToanRepository } from "../adapters/postgres/ke-toan.repository";
import { PostgresNotificationRepository } from "../adapters/postgres/notification.repository";
import { AuthController } from "../controllers/auth.controller";
import { CrmController } from "../controllers/crm.controller";
import { DataLanhController } from "../controllers/data-lanh.controller";
import { HealthController } from "../controllers/health.controller";
import { KeToanController } from "../controllers/ke-toan.controller";
import { NotificationController } from "../controllers/notification.controller";
import { SecurityController } from "../controllers/security.controller";
import { UploadController } from "../controllers/upload.controller";
import { UserAdminController } from "../controllers/user-admin.controller";
import { createSessionCookies } from "../lib/cookies";
import { createAuthenticate } from "../middlewares/authenticate";
import { createCsrfGuard, type CsrfGuard } from "../middlewares/csrf";
import { createRepositories } from "../repositories/create-repositories";
import { AuthService } from "../services/auth.service";
import { CrmService } from "../services/crm.service";
import { CrmImportService } from "../services/crm-import.service";
import { HealthService } from "../services/health.service";
import { KeToanService } from "../services/ke-toan.service";
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
  dataLanhController: DataLanhController;
  keToanController: KeToanController;
  notificationController: NotificationController;
  uploadController: UploadController;
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
  const cloudinary = cloudinaryConfigFromParts({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    uploadFolder: env.CLOUDINARY_UPLOAD_FOLDER,
  });
  if (cloudinary) ensureCloudinary(cloudinary);

  return {
    env,
    authController: new AuthController(auth, cookies),
    healthController: new HealthController(new HealthService(repositories.users)),
    securityController: new SecurityController(csrf.issue),
    userAdminController: new UserAdminController(new UserAdminService(repositories.users)),
    crmController: new CrmController(new CrmService(
      crm,
      notificationService,
      crm && pool ? new CrmImportService(crm, new PostgresCrmImportStore(pool)) : null,
    )),
    dataLanhController: new DataLanhController(pool ? new PostgresDataLanhRepository(pool) : null),
    keToanController: new KeToanController(new KeToanService(pool ? new PostgresKeToanRepository(pool) : null)),
    notificationController: new NotificationController(notificationService),
    uploadController: new UploadController(cloudinary),
    authenticate: createAuthenticate(env, repositories.users, repositories.sessions),
    csrf,
    close: () => repositories.close(),
  };
}
