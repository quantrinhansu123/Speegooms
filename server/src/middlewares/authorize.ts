import type { RequestHandler } from "express";
import { AppError } from "../lib/errors";
import { can, type Permission } from "../config/permissions";

export function requirePermission(action: Permission): RequestHandler {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role || !can(role, action)) {
      next(new AppError(403, "FORBIDDEN", "Bạn không có quyền thực hiện"));
      return;
    }
    next();
  };
}
