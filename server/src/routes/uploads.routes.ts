import { Router } from "express";
import { z } from "zod";
import { CLOUDINARY_IMAGE_MAX_CHARS, DATA_IMAGE } from "../adapters/cloudinary/rules";
import { asyncHandler } from "../lib/async-handler";
import { validate } from "../middlewares/validate";
import type { AppContainer } from "../container";

const uploadImageSchema = z.object({
  image: z
    .string()
    .trim()
    .min(1, "Thiếu ảnh")
    .max(CLOUDINARY_IMAGE_MAX_CHARS, "Ảnh quá lớn")
    .refine((value) => DATA_IMAGE.test(value), "Ảnh không hợp lệ"),
});

export function uploadRoutes(container: AppContainer) {
  const router = Router();
  router.use(container.authenticate);
  router.post(
    "/image",
    validate({ body: uploadImageSchema }),
    asyncHandler(container.uploadController.createImage),
  );
  return router;
}
