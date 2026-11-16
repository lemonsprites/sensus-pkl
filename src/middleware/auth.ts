import type { Request, RequestHandler } from "express";

import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";

const extractBearer = (header?: string): string | null => {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
};

/**
 * Verifikasi Bearer token + cek isActive & tokenVersion di DB.
 * tokenVersion naik (logout / reset password / deactivate) → token lama 401.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractBearer(req.headers.authorization);
    if (!token) throw ApiError.unauthorized();

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true, tokenVersion: true },
    });

    if (!user || !user.isActive) throw ApiError.unauthorized("Akun tidak aktif");
    if (user.tokenVersion !== payload.tokenVersion) {
      throw ApiError.unauthorized("Sesi sudah tidak berlaku. Silakan login ulang.");
    }

    req.user = { id: user.id, role: user.role, tokenVersion: user.tokenVersion };
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    next(ApiError.unauthorized("Sesi tidak valid atau kedaluwarsa"));
  }
};

/** Ambil user terautentikasi (throw bila kosong). */
export const currentUser = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
};
