import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../../lib/errors";
import {
  CLOUDINARY_FOLDER,
  CLOUDINARY_IMAGE_MAX_CHARS,
  DATA_IMAGE,
  normalizeCloudinaryFolder,
} from "./rules";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadFolder: string;
};

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
};

/** Tránh gọi cloudinary.config() mỗi request. */
let configuredFingerprint: string | null = null;

function fingerprint(config: CloudinaryConfig): string {
  return `${config.cloudName}\0${config.apiKey}\0${config.apiSecret}`;
}

export function cloudinaryConfigFromParts(parts: {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
  uploadFolder?: string;
}): CloudinaryConfig | undefined {
  const cloudName = parts.cloudName?.trim();
  const apiKey = parts.apiKey?.trim();
  const apiSecret = parts.apiSecret?.trim();
  if (!cloudName || !apiKey || !apiSecret) return undefined;
  const uploadFolder = normalizeCloudinaryFolder(parts.uploadFolder);
  if (!CLOUDINARY_FOLDER.test(uploadFolder)) {
    throw new AppError(503, "UPLOAD_UNAVAILABLE", "CLOUDINARY_UPLOAD_FOLDER không hợp lệ");
  }
  return { cloudName, apiKey, apiSecret, uploadFolder };
}

export function ensureCloudinary(config: CloudinaryConfig): void {
  const next = fingerprint(config);
  if (configuredFingerprint === next) return;
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
  configuredFingerprint = next;
}

export function normalizeUploadFolder(folder: string | undefined): string {
  const value = normalizeCloudinaryFolder(folder);
  if (!CLOUDINARY_FOLDER.test(value)) {
    throw new AppError(503, "UPLOAD_UNAVAILABLE", "CLOUDINARY_UPLOAD_FOLDER không hợp lệ");
  }
  return value;
}

export async function uploadImage(
  config: CloudinaryConfig | undefined,
  dataUri: string,
): Promise<CloudinaryUploadResult> {
  if (!config) {
    throw new AppError(
      503,
      "UPLOAD_UNAVAILABLE",
      "Chưa cấu hình CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET",
    );
  }
  ensureCloudinary(config);
  const folder = normalizeUploadFolder(config.uploadFolder);
  const image = dataUri.trim();
  if (!DATA_IMAGE.test(image) || image.length > CLOUDINARY_IMAGE_MAX_CHARS) {
    throw new AppError(400, "VALIDATION_ERROR", "Ảnh không hợp lệ hoặc quá lớn");
  }
  try {
    const result = await cloudinary.uploader.upload(image, {
      folder,
      resource_type: "image",
      overwrite: false,
    });
    if (!result.secure_url || !result.public_id) {
      throw new AppError(502, "UPLOAD_FAILED", "Cloudinary không trả về URL ảnh");
    }
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const http =
      err && typeof err === "object" && "http_code" in err && typeof err.http_code === "number"
        ? err.http_code
        : undefined;
    const detail =
      err && typeof err === "object" && "error" in err && err.error && typeof err.error === "object" && "message" in err.error
        ? String(err.error.message)
        : err instanceof Error
          ? err.message
          : undefined;
    if (http === 401 || http === 403) {
      throw new AppError(
        502,
        "UPLOAD_FAILED",
        "Cloudinary từ chối upload (sai key hoặc API key thiếu quyền Upload). Dùng Master key hoặc bật quyền Upload trong Console, rồi cập nhật CLOUDINARY_* trong server/.env",
      );
    }
    throw new AppError(
      502,
      "UPLOAD_FAILED",
      detail ? `Không tải được ảnh lên Cloudinary: ${detail}` : "Không tải được ảnh lên Cloudinary",
    );
  }
}
