import { z } from "zod";
import { CLOUDINARY_FOLDER, normalizeCloudinaryFolder } from "../adapters/cloudinary/rules";

const DEV_SESSION_SECRET = "dev-only-session-secret-do-not-use-prod";
const DEV_CSRF_SECRET = "dev-only-csrf-secret-do-not-use-prod!!";
const DEV_SEED_PASSWORD = "speego@demo";

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DB_PROVIDER: z.enum(["memory", "postgres", "supabase"]).default("memory"),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().optional(),
  SESSION_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().min(1).default("http://localhost:3000,http://127.0.0.1:3000"),
  SEED_USER_PASSWORD: z.string().min(8).max(128).optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});

export interface Env {
  NODE_ENV: "development" | "test" | "production";
  HOST: string;
  PORT: number;
  DB_PROVIDER: "memory" | "postgres" | "supabase";
  DATABASE_URL?: string;
  DATABASE_SSL: boolean;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_UPLOAD_FOLDER: string;
  SESSION_SECRET: string;
  CSRF_SECRET: string;
  CORS_ORIGINS: string[];
  SEED_USER_PASSWORD?: string;
  TRUST_PROXY: boolean;
  /** Số kết nối Postgres giữ trong một process. Vercel dùng 1 để khỏi cạn pool. */
  PG_POOL_MAX: number;
}

function filled(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const nodeEnv = source.NODE_ENV || "development";
  const devLike = nodeEnv === "development" || nodeEnv === "test";
  return {
    NODE_ENV: nodeEnv,
    HOST: source.HOST || undefined,
    PORT: source.PORT || undefined,
    DB_PROVIDER: source.DB_PROVIDER || undefined,
    DATABASE_URL: source.DATABASE_URL || undefined,
    DATABASE_SSL: source.DATABASE_SSL || undefined,
    SUPABASE_URL: source.SUPABASE_URL || undefined,
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY || undefined,
    CLOUDINARY_CLOUD_NAME: source.CLOUDINARY_CLOUD_NAME || undefined,
    CLOUDINARY_API_KEY: source.CLOUDINARY_API_KEY || undefined,
    CLOUDINARY_API_SECRET: source.CLOUDINARY_API_SECRET || undefined,
    CLOUDINARY_UPLOAD_FOLDER: source.CLOUDINARY_UPLOAD_FOLDER || undefined,
    SESSION_SECRET: source.SESSION_SECRET || (devLike ? DEV_SESSION_SECRET : undefined),
    CSRF_SECRET: source.CSRF_SECRET || (devLike ? DEV_CSRF_SECRET : undefined),
    CORS_ORIGINS: source.CORS_ORIGINS || undefined,
    SEED_USER_PASSWORD: source.SEED_USER_PASSWORD || (devLike ? DEV_SEED_PASSWORD : undefined),
    TRUST_PROXY: source.TRUST_PROXY || (source.VERCEL === "1" ? "true" : undefined),
  };
}

function parseOrigins(value: string): string[] {
  const origins = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (origins.length === 0) throw new Error("CORS_ORIGINS trống");
  return origins.map((origin) => {
    if (origin === "*") throw new Error("CORS_ORIGINS không được là * khi dùng cookie");
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS origin không hợp lệ: ${origin}`);
    }
    if (url.username || url.password) throw new Error("CORS origin không được chứa thông tin đăng nhập");
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("CORS origin phải là http hoặc https");
    return url.origin;
  });
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = rawSchema.safeParse(filled(source));
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Cấu hình môi trường không hợp lệ: ${message}`);
  }
  const raw = parsed.data;
  if (raw.NODE_ENV === "production" && raw.DB_PROVIDER === "memory") {
    throw new Error("Cấu hình môi trường không hợp lệ: production không được dùng DB_PROVIDER=memory");
  }
  if (raw.DB_PROVIDER === "postgres") {
    if (!raw.DATABASE_URL || !/^postgres(?:ql)?:\/\//.test(raw.DATABASE_URL)) {
      throw new Error("Cấu hình môi trường không hợp lệ: DATABASE_URL phải là postgresql://");
    }
  }
  if (raw.DB_PROVIDER === "supabase") {
    if (!raw.SUPABASE_URL || !raw.SUPABASE_SERVICE_ROLE_KEY || raw.SUPABASE_SERVICE_ROLE_KEY.length < 20) {
      throw new Error("Cấu hình môi trường không hợp lệ: thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
    }
    let supabase: URL;
    try {
      supabase = new URL(raw.SUPABASE_URL);
    } catch {
      throw new Error("Cấu hình môi trường không hợp lệ: SUPABASE_URL không hợp lệ");
    }
    if (supabase.protocol !== "https:" && raw.NODE_ENV === "production") {
      throw new Error("Cấu hình môi trường không hợp lệ: SUPABASE_URL production phải là https");
    }
  }
  const cloudName = raw.CLOUDINARY_CLOUD_NAME?.trim() || undefined;
  const apiKey = raw.CLOUDINARY_API_KEY?.trim() || undefined;
  const apiSecret = raw.CLOUDINARY_API_SECRET?.trim() || undefined;
  const uploadFolder = normalizeCloudinaryFolder(raw.CLOUDINARY_UPLOAD_FOLDER);
  const cloudinaryParts = [cloudName, apiKey, apiSecret].filter(Boolean).length;
  if (cloudinaryParts > 0 && cloudinaryParts < 3) {
    throw new Error(
      "Cấu hình môi trường không hợp lệ: cần đủ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET",
    );
  }
  if (cloudName && !/^[a-z0-9_-]+$/i.test(cloudName)) {
    throw new Error("Cấu hình môi trường không hợp lệ: CLOUDINARY_CLOUD_NAME không hợp lệ");
  }
  if (apiKey && !/^\d+$/.test(apiKey)) {
    throw new Error("Cấu hình môi trường không hợp lệ: CLOUDINARY_API_KEY không hợp lệ");
  }
  if (apiSecret && apiSecret.length < 10) {
    throw new Error("Cấu hình môi trường không hợp lệ: CLOUDINARY_API_SECRET quá ngắn");
  }
  if (!CLOUDINARY_FOLDER.test(uploadFolder)) {
    throw new Error("Cấu hình môi trường không hợp lệ: CLOUDINARY_UPLOAD_FOLDER không hợp lệ");
  }

  const corsOrigins = appendVercelOrigin(parseOrigins(raw.CORS_ORIGINS), source.VERCEL_URL);
  return {
    NODE_ENV: raw.NODE_ENV,
    HOST: raw.HOST,
    PORT: raw.PORT,
    DB_PROVIDER: raw.DB_PROVIDER,
    DATABASE_URL: raw.DATABASE_URL,
    DATABASE_SSL: raw.DATABASE_SSL === "true",
    SUPABASE_URL: raw.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: raw.SUPABASE_SERVICE_ROLE_KEY,
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
    CLOUDINARY_UPLOAD_FOLDER: uploadFolder,
    SESSION_SECRET: raw.SESSION_SECRET,
    CSRF_SECRET: raw.CSRF_SECRET,
    CORS_ORIGINS: corsOrigins,
    SEED_USER_PASSWORD: raw.SEED_USER_PASSWORD,
    TRUST_PROXY: raw.TRUST_PROXY === "true",
    PG_POOL_MAX: source.VERCEL === "1" ? 1 : 10,
  };
}

function appendVercelOrigin(origins: string[], vercelUrl: string | undefined): string[] {
  const host = vercelUrl?.trim();
  if (!host) return origins;
  let url: URL;
  try {
    url = new URL(host.includes("://") ? host : `https://${host}`);
  } catch {
    throw new Error("Cấu hình môi trường không hợp lệ: VERCEL_URL không hợp lệ");
  }
  if (url.username || url.password) throw new Error("Cấu hình môi trường không hợp lệ: VERCEL_URL không hợp lệ");
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Cấu hình môi trường không hợp lệ: VERCEL_URL không hợp lệ");
  }
  if (origins.includes(url.origin)) return origins;
  return [...origins, url.origin];
}
