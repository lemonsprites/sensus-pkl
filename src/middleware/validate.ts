import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";

import { ApiError } from "../utils/apiError.js";

interface ValidateSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validasi input dengan Zod lalu ganti req.* dengan hasil parse.
 *
 * Express 5 membuat `req.query` READ-ONLY (getter di prototype), sehingga
 * assignment `req.query = ...` melempar TypeError. Kita ganti nilainya dengan
 * Object.defineProperty agar route tetap bisa membaca `req.query` seperti biasa.
 * Hasil parse juga disimpan di `req.validated` untuk tipe yang lebih aman.
 */
export const validate = (schemas: ValidateSchemas): RequestHandler => {
  return (req: Request, _res, next) => {
    const issues: Array<{ path: string; message: string }> = [];
    const validated: NonNullable<Request["validated"]> = {};

    (["params", "query", "body"] as const).forEach((key) => {
      const schema = schemas[key];
      if (!schema) return;

      const result = schema.safeParse(req[key]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({
            path: [key, ...issue.path.map(String)].join("."),
            message: issue.message,
          });
        }
        return;
      }

      validated[key] = result.data;

      if (key === "query") {
        Object.defineProperty(req, "query", {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else if (key === "params") {
        req.params = result.data as Request["params"];
      } else {
        req.body = result.data;
      }
    });

    if (issues.length > 0) {
      next(ApiError.badRequest("Data yang dikirim tidak valid", issues));
      return;
    }

    req.validated = validated;
    next();
  };
};
