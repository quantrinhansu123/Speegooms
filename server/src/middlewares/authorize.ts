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

/** Cho phép nếu đủ ít nhất một quyền trong danh sách. */
export function requireAnyPermission(actions: readonly Permission[]): RequestHandler {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role || !actions.some((action) => can(role, action))) {
      next(new AppError(403, "FORBIDDEN", "Bạn không có quyền thực hiện"));
      return;
    }
    next();
  };
}
