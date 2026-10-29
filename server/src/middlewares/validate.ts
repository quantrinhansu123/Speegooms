import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../lib/errors";

export function validate(schemas: { body?: ZodType }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!schemas.body) {
      next();
      return;
    }
    const parsed = schemas.body.safeParse(req.body);
    if (!parsed.success) {
      next(
        new AppError(
          422,
          "VALIDATION_ERROR",
          "Dữ liệu không hợp lệ",
          parsed.error.issues.map((issue) => ({
            path: issue.path.map(String).join(".").slice(0, 80),
            message: issue.message.slice(0, 200),
          })),
        ),
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}
