import { Router } from "express";
import { changePasswordSchema, loginSchema } from "@speego/shared";
import { asyncHandler } from "../lib/async-handler";
import { loginRateLimit } from "../middlewares/rate-limit";
import { validate } from "../middlewares/validate";
import type { AppContainer } from "../container";

export function authRoutes(container: AppContainer) {
  const router = Router();
  const { authController: auth, authenticate } = container;
  router.post("/login", loginRateLimit, validate({ body: loginSchema }), asyncHandler(auth.login));
  router.post("/password", authenticate, loginRateLimit, validate({ body: changePasswordSchema }), asyncHandler(auth.changePassword));
  router.post("/logout", asyncHandler(auth.logout));
  router.get("/me", authenticate, auth.me);
  return router;
}
