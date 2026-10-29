import type { NextFunction, Request, Response } from "express";
import { AppError, InfrastructureError } from "../lib/errors";
import { logger } from "../lib/logger";

function bodyParserError(err: unknown): { status: number; code: string; message: string } | null {
  if (!err || typeof err !== "object" || !("type" in err)) return null;
  const type = String((err as { type?: unknown }).type);
  if (type === "entity.parse.failed") return { status: 400, code: "INVALID_JSON", message: "JSON không hợp lệ" };
  if (type === "entity.too.large") return { status: 413, code: "PAYLOAD_TOO_LARGE", message: "Dữ liệu quá lớn" };
  if (type === "charset.unsupported") return { status: 415, code: "UNSUPPORTED_MEDIA_TYPE", message: "Charset không được hỗ trợ" };
  return null;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  const requestId = req.requestId;
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error("request failed", { requestId, code: err.code, err });
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
        requestId,
      },
    });
    return;
  }
  const parseError = bodyParserError(err);
  if (parseError) {
    res.status(parseError.status).json({
      error: { code: parseError.code, message: parseError.message, requestId },
    });
    return;
  }
  if (err instanceof InfrastructureError) {
    logger.error("infrastructure", { requestId, err });
    res.status(503).json({
      error: { code: "UNAVAILABLE", message: "Dịch vụ dữ liệu chưa sẵn sàng", requestId },
    });
    return;
  }
  logger.error("unhandled", { requestId, err });
  res.status(500).json({
    error: { code: "INTERNAL", message: "Lỗi hệ thống", requestId },
  });
}
