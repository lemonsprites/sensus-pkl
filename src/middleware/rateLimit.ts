import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";

import { redisRaw, redisReady } from "../lib/redis.js";
import { K } from "../lib/redisKeys.js";
import { ApiError } from "../utils/apiError.js";

interface LimiterOptions {
  scope: string;
  limit: number;
  windowMs: number;
  /** Opsional. Jangan pakai req.ip mentah (validasi IPv6 express-rate-limit). */
  keyBy?: (req: Request) => string;
}

function createLimiter({ scope, limit, windowMs, keyBy }: LimiterOptions) {
  const store = new RedisStore({
    // prefix WAJIB eksplisit: rate-limit-redis punya prefix sendiri (default "rl:").
    prefix: K.rlPrefix(scope),
    sendCommand: (command: string, ...args: string[]) =>
      redisRaw.call(command, ...args) as Promise<RedisReply>,
  });

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    // Redis mati → fail-open (sekolah tetap bisa input), /health melaporkan false.
    passOnStoreError: true,
    skip: () => !redisReady(),
    ...(keyBy ? { keyGenerator: keyBy } : {}),
    handler: (_req, _res, next) =>
      next(ApiError.rateLimited("Terlalu banyak permintaan. Coba lagi nanti.")),
  });
}

/** Login: 5 percobaan / menit / IP (keyGenerator default = IP). */
export const loginLimiter = createLimiter({ scope: "login", limit: 5, windowMs: 60_000 });

/** Reset password: 3 / jam / user target (endpoint sudah requireAuth). */
export const resetPasswordLimiter = createLimiter({
  scope: "reset-password",
  limit: 3,
  windowMs: 60 * 60_000,
  keyBy: (req) => String((req.params as Record<string, string>).id ?? req.user?.id ?? "anonymous"),
});
