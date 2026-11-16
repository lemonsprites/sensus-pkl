import type { ErrorRequestHandler, RequestHandler } from "express";

import { config, isProduction } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { ApiError } from "../utils/apiError.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`,
    },
  });
};

/** Kode error Prisma (P2002, P2025, ...) tanpa import class runtime. */
const prismaErrorCode = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : null;
};

const bodyParserType = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const type = (error as { type?: unknown }).type;
  return typeof type === "string" ? type : null;
};

const mapPrismaError = (code: string): ApiError => {
  switch (code) {
    case "P2002":
      return ApiError.conflict("Data yang sama sudah terdaftar");
    case "P2025":
      return ApiError.notFound();
    case "P2003":
      return ApiError.badRequest("Referensi data tidak valid");
    default:
      return ApiError.internal();
  }
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let apiError: ApiError;
  const parserType = bodyParserType(error);
  const prismaCode = prismaErrorCode(error);

  if (error instanceof ApiError) {
    apiError = error;
  } else if (parserType === "entity.too.large") {
    apiError = ApiError.badRequest("Data yang dikirim terlalu besar");
  } else if (parserType === "entity.parse.failed") {
    apiError = ApiError.badRequest("Format JSON yang dikirim tidak valid");
  } else if (prismaCode) {
    apiError = mapPrismaError(prismaCode);
  } else if (error instanceof Error && error.name === "MulterError") {
    const multerCode = (error as { code?: unknown }).code;
    apiError =
      multerCode === "LIMIT_FILE_SIZE"
        ? ApiError.badRequest(`Ukuran file melebihi ${config.IMPORT_MAX_SIZE_MB} MB`)
        : ApiError.badRequest("Upload file gagal");
  } else if (error instanceof Error && error.name === "ZodError") {
    apiError = ApiError.badRequest("Data yang dikirim tidak valid");
  } else {
    apiError = ApiError.internal();
  }

  if (apiError.status >= 500) {
    logger.error({ err: error }, "Unhandled error");
  } else {
    logger.warn({ code: apiError.code, msg: apiError.message }, "Request ditolak");
  }

  res.status(apiError.status).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
      ...(!isProduction && apiError.status >= 500 && error instanceof Error
        ? { stack: error.stack }
        : {}),
    },
  });
};
